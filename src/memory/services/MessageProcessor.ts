import { BaseService } from './BaseService';
import { conversationService } from './ConversationService';
import { summaryService } from './SummaryService';
import { MESSAGE_PROCESSOR_CONFIG } from '../constants/message';
import { 
    MessagePair, 
    ProcessingError,
    ProcessingResult,
    MessageOperation,
    MessageProcessingErrorType
} from '../types/message';
import { CreateMessage, Message } from '../types';

/**
 * Service for processing messages and managing conversation summaries
 */
class MessageProcessor extends BaseService {
    private static instance: MessageProcessor;
    private conversationService = conversationService;
    private summaryService = summaryService;
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
                this.triggerSummaryGeneration(conversationId, newCount)
                    .catch(error => console.error('Background summary generation failed:', error));
            }

            return {
                success: true,
                messageIds: [result.userMsg.id, result.assistantMsg.id],
                summaryPending: this.shouldGenerateSummary(newCount)
            };

        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return {
                    success: false,
                    messageIds: [],
                    summaryPending: false,
                    error: {
                        operation: MessageOperation.GET_METADATA,
                        type: MessageProcessingErrorType.CONVERSATION_NOT_FOUND,
                        error: error
                    }
                };
            } else {
                console.error('Error processing message pair:', error);
                return {
                    success: false,
                    messageIds: [],
                    summaryPending: false,
                    error: {
                        operation: MessageOperation.STORE_MESSAGE,
                        type: MessageProcessingErrorType.STORAGE_ERROR,
                        error: error instanceof Error ? error : new Error(String(error))
                    }
                };
            }
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
            this.triggerSummaryGeneration(conversationId, newCount)
                .catch(error => console.error('Background summary generation failed:', error));
        }

        return storedMessage;
    }

    /**
     * Get messages for summary generation, handling tool calls appropriately
     */
    private async getMessagesForSummary(conversationId: string): Promise<Message[]> {
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
        try {
            // Get messages including extra context if needed
            const messages = await this.getMessagesForSummary(conversationId);
            
            // Extract themes and generate summary
            const themes = messages.reduce<string[]>((acc, msg) => {
                if (msg.themes) {
                    acc.push(...msg.themes);
                }
                return acc;
            }, []);

            // Create the summary
            await this.summaryService.createSummary(
                conversationId,
                'recent',
                JSON.stringify(messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))),
                Array.from(new Set(themes))  // Deduplicate themes
            );

        } catch (error) {
            console.error('Error generating summary:', error);
            throw error;
        }
    }

    /**
     * Check if we should generate a summary based on message count
     */
    private shouldGenerateSummary(messageCount: number): boolean {
        return messageCount > 0 && messageCount % this.config.summaryChunkSize === 0;
    }

    /**
     * Update conversation metadata
     */
    private async updateConversationMetadata(
        conversationId: string,
        messageCount: number
    ): Promise<void> {
        await this.withErrorHandling(async () => {
            await this.conversationService.updateMetadata(conversationId, {
                messageCount,
                lastActivity: new Date()
            });
        }, MessageOperation.UPDATE_METADATA);
    }

    /**
     * Error handling wrapper for async operations
     */
    private async withErrorHandling<T>(
        operation: () => Promise<T>,
        operationType: MessageOperation,
        retryCount = 0
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                // Wait before retrying
                await new Promise(resolve => 
                    setTimeout(resolve, this.config.retryDelayMs)
                );
                return this.withErrorHandling(
                    operation,
                    operationType,
                    retryCount + 1
                );
            }
            throw error;
        }
    }
}

// Export only the singleton instance
export const messageProcessor = MessageProcessor.getInstance();
