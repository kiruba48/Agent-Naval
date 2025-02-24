import { BaseService } from './BaseService';
import { conversationService } from './ConversationService';
import { SummaryService } from './SummaryService';  
import { MESSAGE_PROCESSOR_CONFIG } from '../constants/message';
import { Message, CreateMessage } from '../types';
import { 
    ProcessingResult,
    MessageOperation,
    MessageProcessingErrorType
} from '../types/message';
import { ProcessingError } from '../errors/ProcessingError';
import { logger } from '../../utils/logger';

/**
 * Service for processing messages and managing conversation summaries
 */
export class MessageProcessor extends BaseService {
    private static instance: MessageProcessor;
    private conversationService = conversationService;
    private summaryService?: SummaryService;  
    private config = MESSAGE_PROCESSOR_CONFIG;

    private constructor() {
        super();
    }

    public static getInstance(): MessageProcessor {
        if (!MessageProcessor.instance) {
            MessageProcessor.instance = new MessageProcessor();
        }
        return MessageProcessor.instance;
    }

    /**
     * Initialize dependencies after construction
     */
    public initializeDependencies(summaryService: SummaryService) {
        this.summaryService = summaryService;
    }

    /**
     * Get the summary service instance, throwing if not initialized
     */
    private getSummaryService(): SummaryService {
        if (!this.summaryService) {
            throw new Error('SummaryService not initialized in MessageProcessor');
        }
        return this.summaryService;
    }

    /**
     * Process a message pair (user + assistant messages)
     */
    public async processMessagePair(
        conversationId: string,
        userMessage: string,
        assistantMessage: string
    ): Promise<ProcessingResult> {
        try {
            // Get conversation metadata (will throw if conversation doesn't exist)
            const metadata = await this.withErrorHandling(
                () => this.conversationService.getMetadata(conversationId),
                MessageOperation.GET_METADATA
            );

            // Store messages
            const result = await this.withErrorHandling(async () => {
                const userMsg = await this.conversationService.addMessage(conversationId, {
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date()
                });

                const assistantMsg = await this.conversationService.addMessage(conversationId, {
                    role: 'assistant',
                    content: assistantMessage,
                    timestamp: new Date()
                });

                return { userMsg, assistantMsg };
            }, MessageOperation.STORE_MESSAGE);

            // Update message count
            const newCount = metadata.messageCount + 2;
            await this.updateConversationMetadata(conversationId, newCount);

            // Trigger summary generation in background if needed
            if (this.shouldGenerateSummary(newCount)) {
                logger.info('Triggering summary generation', { conversationId, messageCount: newCount });
                this.triggerSummaryGeneration(conversationId, newCount)
                    .catch(error => logger.error('Background summary generation failed:', { error, conversationId }));
            }

            return {
                success: true,
                messageIds: [result.userMsg.id, result.assistantMsg.id],
                summaryPending: this.shouldGenerateSummary(newCount)
            };

        } catch (error) {
            const processingError = error instanceof ProcessingError 
                ? error 
                : new ProcessingError(
                    MessageOperation.STORE_MESSAGE,
                    error instanceof Error ? error : new Error(String(error))
                );

            logger.error('Error processing message pair:', { 
                error: processingError,
                conversationId 
            });

            return {
                success: false,
                messageIds: [],
                summaryPending: false,
                error: {
                    operation: processingError.operation,
                    type: processingError.type,
                    error: processingError.error
                }
            };
        }
    }

    /**
     * Add a single message to the conversation
     */
    public async addMessage(
        conversationId: string,
        message: CreateMessage
    ): Promise<Message> {
        // Get conversation metadata (will throw if conversation doesn't exist)
        const metadata = await this.withErrorHandling(
            () => this.conversationService.getMetadata(conversationId),
            MessageOperation.GET_METADATA
        );

        // Store message
        const storedMessage = await this.withErrorHandling(
            () => this.conversationService.addMessage(conversationId, message),
            MessageOperation.STORE_MESSAGE
        );

        // Update message count
        const newCount = metadata.messageCount + 1;
        await this.updateConversationMetadata(conversationId, newCount);

        // Trigger summary generation in background if needed
        if (this.shouldGenerateSummary(newCount)) {
            logger.info('Triggering summary generation', { conversationId, messageCount: newCount });
            this.triggerSummaryGeneration(conversationId, newCount)
                .catch(error => logger.error('Background summary generation failed:', { error, conversationId }));
        }

        return storedMessage;
    }

    /**
     * Get messages for summary generation, handling tool calls appropriately.
     * This is used by both MessageProcessor and SummaryService to ensure consistent
     * message preparation for summarization.
     */
    public async getMessagesForSummary(conversationId: string): Promise<Message[]> {
        logger.debug('Fetching messages for summary', { conversationId });
        
        // Get last 10 messages (5 pairs)
        const messages = await this.conversationService.getLastMessages(conversationId, 10);
        
        // If the last message has tool calls, get the next message which will be the tool response
        const lastMessage = messages[messages.length - 1];
        // @ts-ignore - handle both snake_case from LLM and camelCase from our storage
        if (lastMessage?.role === 'assistant' && (lastMessage.tool_calls || lastMessage.toolCalls)) {
            // Get one more message to include the tool response
            const extraContext = await this.conversationService.getLastMessages(
                conversationId,
                11  // Get 11 to include the tool response
            );
            
            logger.debug('Including extra context for tool call', {
                conversationId,
                originalCount: messages.length,
                newCount: extraContext.length
            });
            
            // Return the extra message if we found it
            return extraContext.length > 10 ? extraContext.slice(-11) : messages;
        }

        return messages;
    }

    /**
     * Trigger summary generation as a background task
     */
    private async triggerSummaryGeneration(
        conversationId: string,
        messageCount: number
    ): Promise<void> {
        const startTime = Date.now();
        logger.info('Starting summary generation', { conversationId, messageCount });
       
        try {
            // Get messages for summary
            const messages = await this.getMessagesForSummary(conversationId);
            
            // Collect themes from messages
            const themes = messages.reduce<string[]>((acc, msg) => {
                if (msg.themes) acc.push(...msg.themes);
                return acc;
            }, []);

            // Generate summary using SummaryService
            await this.getSummaryService().generateRecentSummary(
                conversationId,
                messages,
                Array.from(new Set(themes))
            );
            
            logger.info('Summary generation completed', {
                conversationId,
                timing: Date.now() - startTime,
                themes: themes.length
            });
        } catch (error) {
            const processingError = error instanceof ProcessingError 
                ? error 
                : new ProcessingError(
                    MessageOperation.GENERATE_SUMMARY,
                    error instanceof Error ? error : new Error(String(error))
                );

            logger.error('Summary generation failed', {
                conversationId,
                error: processingError,
                timing: Date.now() - startTime
            });

            throw processingError;
        }
    }

    /**
     * Check if we should generate a summary based on message count
     */
    private shouldGenerateSummary(messageCount: number): boolean {
        return messageCount % this.config.summaryChunkSize === 0;
    }

    /**
     * Update conversation metadata with new message count
     */
    private async updateConversationMetadata(
        conversationId: string,
        messageCount: number
    ): Promise<void> {
        await this.withErrorHandling(
            () => this.conversationService.updateMetadata(conversationId, { messageCount }),
            MessageOperation.UPDATE_METADATA
        );
    }

    /**
     * Error handling wrapper with operation context
     */
    private async withErrorHandling<T>(
        operation: () => Promise<T>,
        operationType: MessageOperation
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw new ProcessingError(
                operationType,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
}

// Export only the singleton instance
export const messageProcessor = MessageProcessor.getInstance();
