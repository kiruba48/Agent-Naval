import { BaseService } from './BaseService';
import { ConversationSummary, Message } from '../types';
import { SummaryReadyMessage } from '../types/conversation';
import { SUMMARY_TYPES } from '../constants/config';
import { MessageProcessor } from './MessageProcessor';
import { vectorService } from './VectorService';
import { logger } from '../../utils/logger';
import { VECTOR_INDICES } from '../constants/vector';
import { generateText, LLAMA_70B } from '../../llm';

interface SummaryData {
  summary_text: string;
  themes: string[];
  timestamp_range: string;
  metadata: {
    conversationId: string;
    messageCount: number;
    startTime: string;
    endTime: string;
  };
}

/**
 * Service for managing hierarchical conversation summaries
 */
export class SummaryService extends BaseService {
  private static instance: SummaryService;
  private messageProcessor?: MessageProcessor;
  private vectorService = vectorService;

  private constructor() {
    super();
  }

  public static getInstance(): SummaryService {
    if (!SummaryService.instance) {
      SummaryService.instance = new SummaryService();
    }
    return SummaryService.instance;
  }

  /**
   * Initialize dependencies after construction
   */
  public initializeDependencies(messageProcessor: MessageProcessor) {
    this.messageProcessor = messageProcessor;
  }

  /**
   * Get the message processor instance, throwing if not initialized
   */
  private getMessageProcessor(): MessageProcessor {
    if (!this.messageProcessor) {
      throw new Error('MessageProcessor not initialized in SummaryService');
    }
    return this.messageProcessor;
  }

  /**
   * Generate and store a recent summary in vector store
   */
  async generateRecentSummary(
    conversationId: string,
    messages: Message[],
    themes: string[]
  ): Promise<ConversationSummary> {
    const startTime = Date.now();
    logger.info('Generating recent summary', {
      conversationId,
      messageCount: messages.length,
    });

    try {
      // Filter and transform messages to summary-ready format
      const summaryReadyMessages = messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          themes: msg.themes,
        }));

      // Generate summary text
      const summary_text = await this.summarizeMessages(summaryReadyMessages);

      const summaryData: SummaryData = {
        summary_text,
        themes: Array.from(new Set(themes)),
        timestamp_range: this.getTimestampRange(messages),
        metadata: {
          conversationId,
          messageCount: messages.length,
          startTime: messages[0].timestamp.toISOString(),
          endTime: messages[messages.length - 1].timestamp.toISOString(),
        },
      };

      // Store in vector database
      const vectorId = await this.vectorService.upsertVector(
        VECTOR_INDICES.CONVERSATIONS.name,
        {
          text: summaryData.summary_text,
          metadata: {
            timestamp: new Date().toISOString(),
            type: SUMMARY_TYPES.recent,
            summaryId: crypto.randomUUID(),
            conversationId,
            messageCount: messages.length,
            startTime: messages[0].timestamp.toISOString(),
            endTime: messages[messages.length - 1].timestamp.toISOString(),
            themes: Array.from(new Set(themes)),
            significantInsights: [],
            userPreferences: {},
          },
        }
      );

      logger.info('Summary stored in vector database', {
        conversationId,
        vectorId,
        timing: Date.now() - startTime,
      });

      return {
        id: vectorId,
        level: SUMMARY_TYPES.recent,
        content: summaryData.summary_text,
        themes: Array.from(new Set(themes)),
        timestamp: new Date(),
        metadata: {
          significantInsights: [], // Optional field for future use
          userPreferences: {}, // Optional field for future use
        },
      };
    } catch (error) {
      logger.error('Failed to generate or store summary', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
        timing: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Generate a timestamp range string for a set of messages
   */
  private getTimestampRange(messages: Message[]): string {
    if (messages.length === 0) return '';

    const startTime = messages[0].timestamp;
    const endTime = messages[messages.length - 1].timestamp;

    // If same day, show times only
    if (startTime.toDateString() === endTime.toDateString()) {
      return `${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`;
    }

    // Different days, show dates and times
    return `${startTime.toLocaleString()} - ${endTime.toLocaleString()}`;
  }

  /**
   * Format messages into a readable conversation format
   */
  private formatMessagesForSummary(messages: SummaryReadyMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const timestamp = new Date(msg.timestamp).toISOString();
        return `[${timestamp}] ${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Generate a summary of the conversation messages
   */
  private async summarizeMessages(
    messages: SummaryReadyMessage[]
  ): Promise<string> {
    try {
      const formattedConversation = this.formatMessagesForSummary(messages);

      const prompt = `Please provide a concise but comprehensive summary of the following conversation. 
Focus on:
- Key points and main topics discussed
- Important decisions or conclusions reached
- Action items or next steps identified
- Any significant problems or challenges mentioned

Keep the summary objective and factual, maintaining chronological order where relevant.

Conversation:
${formattedConversation}

Summary:`;

      logger.info('Generating summary using LLM', {
        messageCount: messages.length,
        firstMessageTime: new Date(messages[0].timestamp).toISOString(),
        lastMessageTime: new Date(
          messages[messages.length - 1].timestamp
        ).toISOString(),
      });

      const summary = await generateText(prompt, LLAMA_70B);

      if (!summary) {
        throw new Error('Failed to generate summary: empty response from LLM');
      }

      return summary.trim();
    } catch (error) {
      logger.error('Failed to generate summary', {
        error: error instanceof Error ? error.message : String(error),
        messageCount: messages.length,
      });
      throw new Error(
        `Failed to generate summary: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Transform raw messages into a format optimized for summarization.
   * Reuses MessageProcessor's getMessagesForSummary for consistent message filtering.
   */
  private async prepareMessagesForSummary(
    conversationId: string
  ): Promise<SummaryReadyMessage[]> {
    try {
      // Get filtered messages using existing logic
      const messages = await this.getMessageProcessor().getMessagesForSummary(
        conversationId
      );

      logger.debug('Retrieved messages for summarization', {
        conversationId,
        messageCount: messages.length,
      });

      // Transform messages into summary-ready format
      // Filter out system messages and ensure only user/assistant messages are included
      return messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          themes: msg.themes,
        }));
    } catch (error) {
      logger.error('Failed to prepare messages for summary', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate a global summary by combining recent summaries
   */
  async generateGlobalSummary(
    conversationId: string,
    recentSummaries: ConversationSummary[]
  ): Promise<ConversationSummary> {
    const startTime = Date.now();
    logger.info('Generating global summary', {
      conversationId,
      summaryCount: recentSummaries.length,
    });

    try {
      // Combine recent summaries into a global summary
      const combinedContent = recentSummaries
        .map((s) => s.content)
        .join('\n\n');

      // Collect all themes from recent summaries
      const allThemes = recentSummaries.reduce<string[]>((acc, summary) => {
        if (summary.themes) acc.push(...summary.themes);
        return acc;
      }, []);

      // Collect all insights and preferences
      const allInsights = recentSummaries.reduce<string[]>((acc, summary) => {
        if (summary.metadata?.significantInsights) {
          acc.push(...summary.metadata.significantInsights);
        }
        return acc;
      }, []);

      const allPreferences = recentSummaries.reduce<Record<string, number>>(
        (acc, summary) => {
          if (summary.metadata?.userPreferences) {
            Object.entries(summary.metadata.userPreferences).forEach(
              ([key, value]) => {
                // Average the preference values if they appear multiple times
                acc[key] = acc[key] ? (acc[key] + value) / 2 : value;
              }
            );
          }
          return acc;
        },
        {}
      );

      // Generate the global summary text
      const globalSummaryText = await this.summarizeMessages(
        recentSummaries.map((s) => ({
          role: 'assistant' as const,
          content: s.content,
          timestamp: s.timestamp,
          themes: s.themes,
        }))
      );

      // Store in vector database
      const vectorId = await this.vectorService.upsertVector(
        VECTOR_INDICES.CONVERSATIONS.name,
        {
          text: globalSummaryText,
          metadata: {
            timestamp: new Date().toISOString(),
            type: SUMMARY_TYPES.global,
            summaryId: crypto.randomUUID(),
            conversationId,
            summaryCount: recentSummaries.length,
            timeRange: {
              startTime: recentSummaries[0].timestamp.toISOString(),
              endTime:
                recentSummaries[
                  recentSummaries.length - 1
                ].timestamp.toISOString(),
            },
          },
        }
      );

      logger.info('Global summary stored in vector database', {
        conversationId,
        vectorId,
        timing: Date.now() - startTime,
      });

      return {
        id: vectorId,
        level: SUMMARY_TYPES.global,
        content: globalSummaryText,
        themes: Array.from(new Set(allThemes)),
        timestamp: new Date(),
        metadata: {
          significantInsights: Array.from(new Set(allInsights)),
          userPreferences: allPreferences,
        },
      };
    } catch (error) {
      logger.error('Failed to generate or store global summary', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
        timing: Date.now() - startTime,
      });
      throw error;
    }
  }
}

// Export only the singleton instance
export const summaryService = SummaryService.getInstance();
