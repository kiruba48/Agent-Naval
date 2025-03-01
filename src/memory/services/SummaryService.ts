import { BaseService } from './BaseService';
import { ConversationSummary, Message } from '../types';
import { SummaryReadyMessage } from '../types/conversation';
import { SUMMARY_TYPES } from '../constants/config';
import { MessageProcessor } from './MessageProcessor';
import { vectorService } from './VectorService';
import { conversationService } from './ConversationService';
import { logger } from '../../utils/logger';
import { VECTOR_INDICES } from '../constants/vector';
import { generateText, LLAMA_70B } from '../../llm';
import { FIREBASE_PATHS } from '../constants/config';

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
   * Get the user ID for a conversation
   */
  private async getUserId(conversationId: string): Promise<string> {
    try {
      // Access the conversation metadata directly from the conversationService
      const metadata = await conversationService.getMetadata(conversationId);
      return metadata.userId;
    } catch (error) {
      logger.error('Failed to get user ID for conversation', {
        conversationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Ensure a timestamp is a valid Date object
   * @param timestamp The timestamp to validate
   * @returns A valid Date object
   */
  private ensureValidDate(timestamp: any): Date {
    // Use the base implementation through convertTimestamps
    const convertedValue = this.convertTimestamps(timestamp);
    
    // If conversion resulted in a Date, return it
    if (convertedValue instanceof Date) {
      return convertedValue;
    }
    
    // If conversion didn't result in a Date, create a new one
    // This can happen if the timestamp wasn't in ISO format
    logger.warn('Timestamp not converted to Date by base implementation', {
      type: typeof timestamp,
      value: typeof timestamp === 'object' ? JSON.stringify(timestamp) : timestamp
    });
    return new Date();
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
      // Validate message count
      if (messages.length < 2) {
        logger.warn('Not enough messages to generate summary', {
          conversationId,
          messageCount: messages.length
        });
        throw new Error('Not enough messages to generate summary');
      }
      
      // Get the user ID for this conversation
      const userId = await this.getUserId(conversationId);
      
      // Validate timestamps
      messages.forEach((msg, index) => {
        try {
          // Use ensureValidDate to validate and fix timestamps
          msg.timestamp = this.ensureValidDate(msg.timestamp);
        } catch (error) {
          logger.warn('Error validating timestamp', {
            conversationId,
            messageIndex: index,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // Filter and transform messages to summary-ready format
      const summaryReadyMessages = messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'tool',
          content: msg.role === 'tool' ? this.transformToolContent(msg) : msg.content,
          timestamp: this.ensureValidDate(msg.timestamp),
          themes: msg.themes,
          name: msg.role === 'tool' ? msg.name : undefined
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
          startTime: this.ensureValidDate(messages[0].timestamp).toISOString(),
          endTime: this.ensureValidDate(messages[messages.length - 1].timestamp).toISOString(),
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
            userId, // Add user ID to metadata
            messageCount: messages.length,
            startTime: this.ensureValidDate(messages[0].timestamp).toISOString(),
            endTime: this.ensureValidDate(messages[messages.length - 1].timestamp).toISOString(),
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

      // Mark messages as summarized
      await this.markMessagesAsSummarized(conversationId, messages);

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
   * Get a formatted timestamp range for the messages
   */
  private getTimestampRange(messages: Message[]): string {
    if (!messages.length) return 'No messages';
    
    try {
      const startTime = this.ensureValidDate(messages[0].timestamp);
      const endTime = this.ensureValidDate(messages[messages.length - 1].timestamp);
      
      // If same day, show times only
      if (startTime.toDateString() === endTime.toDateString()) {
        return `${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`;
      }

      // Different days, show dates and times
      return `${startTime.toLocaleString()} - ${endTime.toLocaleString()}`;
    } catch (error) {
      logger.warn('Error generating timestamp range', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'Timestamp range unavailable';
    }
  }

  /**
   * Format messages into a readable conversation format
   */
  private formatMessagesForSummary(messages: SummaryReadyMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : `Tool: ${msg.name}`;
        const timestamp = this.ensureValidDate(msg.timestamp).toISOString();
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
        firstMessageTime: this.ensureValidDate(messages[0].timestamp).toISOString(),
        lastMessageTime: this.ensureValidDate(messages[messages.length - 1].timestamp).toISOString(),
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
  public prepareMessagesForSummary(
    messages: Message[]
  ): SummaryReadyMessage[] {
    try {
      // Validate timestamps
      messages.forEach((msg, index) => {
        try {
          // Use ensureValidDate to validate and fix timestamps
          msg.timestamp = this.ensureValidDate(msg.timestamp);
        } catch (error) {
          logger.warn('Error validating timestamp', {
            messageIndex: index,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // Transform messages into summary-ready format
      return messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'tool',
          content: msg.role === 'tool' ? this.transformToolContent(msg) : msg.content,
          timestamp: this.ensureValidDate(msg.timestamp),
          themes: msg.themes,
          name: msg.role === 'tool' ? msg.name : undefined
        }));
    } catch (error) {
      logger.error('Failed to prepare messages for summary', {
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
      // Get the user ID for this conversation
      const userId = await this.getUserId(conversationId);
      
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
            userId, // Add user ID to metadata
            summaryCount: recentSummaries.length,
            timeRange: {
              startTime: this.ensureValidDate(recentSummaries[0].timestamp).toISOString(),
              endTime: this.ensureValidDate(recentSummaries[recentSummaries.length - 1].timestamp).toISOString(),
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

  /**
   * Transform tool message content to a more summary-friendly format
   */
  private transformToolContent(message: Message): string {
    if (!message.name || !message.content) {
      return 'Tool was called (no details available)';
    }

    try {
      // For knowledge retrieval tool
      if (message.name === 'queryKnowledgeBase' && typeof message.content === 'string') {
        return this.summarizeKnowledgeRetrieval(message.content);
      }
      
      // For other tools or non-JSON content, truncate if too long
      if (typeof message.content === 'string' && message.content.length > 100) {
        return `${message.content.substring(0, 100)}... (content truncated)`;
      }
      
      // Otherwise return as is
      return message.content;
    } catch (error) {
      logger.warn('Error transforming tool content', {
        toolName: message.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return `Tool '${message.name}' was called (content could not be parsed)`;
    }
  }

  /**
   * Summarize knowledge retrieval results
   */
  private summarizeKnowledgeRetrieval(content: string): string {
    try {
      const data = JSON.parse(content);
      
      // Check if we have results
      if (!Array.isArray(data.results) || data.results.length === 0) {
        return 'Knowledge retrieval found no results';
      }
      
      const resultCount = data.results.length;
      const totalResults = data.totalResults || resultCount;
      
      // Extract all themes from all results
      const allThemes = new Set<string>();
      const sourceFiles = new Set<string>();
      
      data.results.forEach((result: any) => {
        // Add themes
        if (result.metadata?.themes) {
          result.metadata.themes.forEach((theme: string) => allThemes.add(theme));
        }
        
        // Add source files
        if (result.metadata?.sourceFile) {
          sourceFiles.add(result.metadata.sourceFile.split('/').pop()); // Just the filename
        }
      });
      
      // Get a preview of the first result's content
      const firstResultPreview = data.results[0]?.content
        ? data.results[0].content.substring(0, 60).trim() + '...'
        : 'No content preview available';
      
      // Format the summary
      let summary = `Knowledge retrieval found ${resultCount} results`;
      
      if (totalResults > resultCount) {
        summary += ` (out of ${totalResults} total)`;
      }
      
      // Add themes if available
      if (allThemes.size > 0) {
        const themeList = Array.from(allThemes).slice(0, 3).join(', ');
        summary += ` on themes: ${themeList}${allThemes.size > 3 ? '...' : ''}`;
      }
      
      // Add source files if there are multiple
      if (sourceFiles.size > 0) {
        const fileList = Array.from(sourceFiles).slice(0, 2).join(', ');
        summary += ` from ${sourceFiles.size} source${sourceFiles.size > 1 ? 's' : ''}: ${fileList}${sourceFiles.size > 2 ? '...' : ''}`;
      }
      
      // Add content preview
      summary += `\nPreview: "${firstResultPreview}"`;
      
      return summary;
    } catch (error) {
      logger.warn('Error summarizing knowledge retrieval', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'Knowledge retrieval was performed (details unavailable)';
    }
  }

  /**
   * Mark messages as summarized to prevent duplicate summarization
   */
  private async markMessagesAsSummarized(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    if (messages.length === 0) return;
    
    try {
      const updates: Record<string, boolean> = {};
      
      // Create a batch update for all messages
      messages.forEach(msg => {
        if (msg.id) {
          updates[`${FIREBASE_PATHS.messages}/${msg.id}/summarized`] = true;
        }
      });
      
      // Apply the updates to Firebase
      if (Object.keys(updates).length > 0) {
        await this.updateData(`${FIREBASE_PATHS.conversations}/${conversationId}`, updates);
        
        logger.debug('Marked messages as summarized', {
          conversationId,
          messageCount: Object.keys(updates).length
        });
      }
    } catch (error) {
      logger.error('Failed to mark messages as summarized', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
        messageCount: messages.length
      });
      // Don't throw - this is a non-critical operation
    }
  }
}

// Export only the singleton instance
export const summaryService = SummaryService.getInstance();
