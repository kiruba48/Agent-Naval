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
     * Trigger summary generation as a background task
     */
    private async triggerSummaryGeneration(
        conversationId: string,
        currentMessageCount: number
    ): Promise<void> {
        try {
            // Calculate the range for this summary chunk
            const chunkSize = this.config.summaryChunkSize;
            const startIndex = currentMessageCount - chunkSize;
            const endIndex = currentMessageCount;

            // Get messages for this chunk
            const messages = await this.withErrorHandling(async () => {
                return await this.conversationService.getMessageRange(
                    conversationId,
                    startIndex,
                    endIndex
                );
            }, MessageOperation.GENERATE_SUMMARY);

            if (!messages || messages.length === 0) {
                throw new Error('No messages found for summary generation');
            }

            // Generate summary using SummaryService
            await this.withErrorHandling(async () => {
                await this.summaryService.createSummary(
                    conversationId,
                    'recent',
                    messages.map(m => m.content).join('\n'),
                    [] // themes will be added later
                );
            }, MessageOperation.GENERATE_SUMMARY);

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
