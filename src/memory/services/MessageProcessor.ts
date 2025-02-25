import { BaseService } from './BaseService';
import { conversationService } from './ConversationService';
import { SummaryService } from './SummaryService';
import { MESSAGE_PROCESSOR_CONFIG } from '../constants/message';
import { Message, CreateMessage } from '../types';
import {
  ProcessingResult,
  MessageOperation,
  MessageProcessingErrorType,
} from '../types/message';
import { ProcessingError } from '../errors/ProcessingError';
import { logger } from '../../utils/logger';
import { MessageRole } from '../types/conversation';

// Type for tool call validation
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Type for complete exchange validation
interface CompleteExchange {
  userMessage: Message;
  assistantToolCall: Message & { tool_calls: ToolCall[] };
  toolResponse: Message;
  finalAnswer: Message;
}

/**
 * Service for processing messages and managing conversation summaries
 */
export class MessageProcessor extends BaseService {
  private static instance: MessageProcessor;
  private conversationService = conversationService;
  private summaryService?: SummaryService;
  private config = MESSAGE_PROCESSOR_CONFIG;
  private toolCallCounters: Map<string, number> = new Map();
  private readonly MAX_CONSECUTIVE_TOOL_CALLS = 3;

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
        const userMsg = await this.conversationService.addMessage(
          conversationId,
          {
            role: 'user',
            content: userMessage,
            timestamp: new Date(),
          }
        );

        const assistantMsg = await this.conversationService.addMessage(
          conversationId,
          {
            role: 'assistant',
            content: assistantMessage,
            timestamp: new Date(),
          }
        );

        return { userMsg, assistantMsg };
      }, MessageOperation.STORE_MESSAGE);

      // Update message count
      const newCount = metadata.messageCount + 2;
      await this.updateConversationMetadata(conversationId, newCount);

      // Check if we should generate a summary
      let summaryPending = false;
      if (this.shouldGenerateSummary(newCount)) {
        logger.info('Triggering summary generation', {
          conversationId,
          messageCount: newCount,
        });
        summaryPending = true;
        this.triggerSummaryGeneration(conversationId, newCount).catch((error) =>
          logger.error('Background summary generation failed:', {
            error,
            conversationId,
          })
        );
      }

      return {
        success: true,
        messageIds: [result.userMsg.id, result.assistantMsg.id],
        summaryPending,
      };
    } catch (error) {
      const processingError =
        error instanceof ProcessingError
          ? error
          : new ProcessingError(
              MessageOperation.STORE_MESSAGE,
              error instanceof Error ? error : new Error(String(error))
            );

      logger.error('Error processing message pair:', {
        error: processingError,
        conversationId,
      });

      return {
        success: false,
        messageIds: [],
        summaryPending: false, // No summary pending on error
        error: {
          operation: processingError.operation,
          type: processingError.type,
          error: processingError.error,
        },
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

    // Check for tool call loops
    this.checkToolCallLoop(conversationId, storedMessage);

    // Update message count
    const newCount = metadata.messageCount + 1;
    await this.updateConversationMetadata(conversationId, newCount);

    // Check if we should generate a summary
    if (
      this.shouldGenerateSummary(newCount) &&
      !this.hasPendingToolCalls(conversationId)
    ) {
      logger.info('Triggering summary generation', {
        conversationId,
        messageCount: newCount,
      });
      this.triggerSummaryGeneration(conversationId, newCount).catch((error) =>
        logger.error('Background summary generation failed:', {
          error,
          conversationId,
        })
      );
    }

    return storedMessage;
  }

  /**
   * Get messages for summary generation, handling tool calls appropriately.
   * This is used by both MessageProcessor and SummaryService to ensure consistent
   * message preparation for summarization.
   */
  public async getMessagesForSummary(
    conversationId: string
  ): Promise<Message[]> {
    logger.debug('Fetching messages for summary', { conversationId });

    // Get last 14 messages to ensure we capture complete exchanges
    const messages = await this.conversationService.getLastMessages(
      conversationId,
      14
    );

    // Find complete exchange
    const completeExchange = this.findCompleteExchange(messages);
    if (completeExchange) {
      logger.debug('Found complete tool call exchange', {
        conversationId,
        exchangeLength: 4,
      });
      return messages.slice(-4); // Return the complete exchange
    }

    // If no complete exchange found, return standard context size
    return messages.slice(-10);
  }

  /**
   * Find a complete tool call exchange in messages
   */
  private findCompleteExchange(messages: Message[]): CompleteExchange | null {
    if (messages.length < 3) return null;

    for (let i = messages.length - 3; i >= 0; i--) {
      const sequence = messages.slice(i, i + 3);
      if (this.isCompleteToolCallSequence(sequence)) {
        return {
          userMessage: sequence[0],
          assistantToolCall: sequence[1] as Message & {
            tool_calls: ToolCall[];
          },
          toolResponse: sequence[2],
          finalAnswer: messages[i + 3],
        };
      }
    }
    return null;
  }

  /**
   * Validate if a sequence of messages forms a complete tool call exchange
   */
  private isCompleteToolCallSequence(messages: Message[]): boolean {
    // Must have at least 3 messages for a complete exchange
    if (messages.length < 3) return false;

    // Check message sequence
    for (let i = 0; i < messages.length - 2; i++) {
      const current = messages[i];
      const next = messages[i + 1];
      const afterNext = messages[i + 2];

      // Check for proper tool call sequence:
      // 1. Assistant message with tool_calls
      // 2. Tool response message
      // 3. Assistant's final answer
      if (
        current.role === 'assistant' &&
        Array.isArray(current.tool_calls) &&
        current.tool_calls.length > 0 &&
        next.role === 'tool' &&
        afterNext.role === 'assistant'
      ) {
        // Verify tool response matches tool call
        const toolCall = current.tool_calls[0];
        if (toolCall && next.name === toolCall.function?.name) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Track and prevent tool call loops
   */
  private checkToolCallLoop(conversationId: string, message: Message): void {
    // Reset counter for non-tool-call messages
    if (
      message.role === 'tool' ||
      (message.role === 'assistant' && !message.tool_calls)
    ) {
      this.toolCallCounters.set(conversationId, 0);
      return;
    }

    // Increment counter for assistant messages with tool calls
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const currentCount = (this.toolCallCounters.get(conversationId) || 0) + 1;
      this.toolCallCounters.set(conversationId, currentCount);

      if (currentCount > this.MAX_CONSECUTIVE_TOOL_CALLS) {
        logger.error('Tool call loop detected', {
          conversationId,
          consecutiveCalls: currentCount,
        });
        throw new ProcessingError(
          MessageOperation.STORE_MESSAGE,
          new Error(
            `Tool call loop detected: ${currentCount} consecutive calls`
          )
        );
      }
    }
  }

  /**
   * Check if there are pending tool calls in the conversation
   */
  private hasPendingToolCalls(conversationId: string): boolean {
    return (this.toolCallCounters.get(conversationId) || 0) > 0;
  }

  /**
   * Trigger summary generation as a background task
   */
  private async triggerSummaryGeneration(
    conversationId: string,
    messageCount: number
  ): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting summary generation', {
      conversationId,
      messageCount,
    });

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
        themes: themes.length,
      });
    } catch (error) {
      const processingError =
        error instanceof ProcessingError
          ? error
          : new ProcessingError(
              MessageOperation.GENERATE_SUMMARY,
              error instanceof Error ? error : new Error(String(error))
            );

      logger.error('Summary generation failed', {
        conversationId,
        error: processingError,
        timing: Date.now() - startTime,
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
      () =>
        this.conversationService.updateMetadata(conversationId, {
          messageCount,
        }),
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
