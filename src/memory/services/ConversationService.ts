import { BaseService } from './BaseService';
import {
  ConversationSession,
  ConversationMetadata,
  Message,
  CreateMessage,
  TopicSegment,
  FirebaseConversation,
  CreateSummary,
  Summary,
} from '../types';
import { ChatMessage } from '../types/conversation';
import {
  FIREBASE_PATHS,
  DEFAULT_CONVERSATION_CONFIG,
  CONVERSATION_STATUS,
} from '../constants/config';
import { logger } from '../../utils/logger';
import { contextRetrievalService } from './ContextRetrievalService';

// Firebase-specific types that use string dates
interface FirebaseMetadata
  extends Omit<ConversationMetadata, 'startTime' | 'lastActivity'> {
  startTime: string;
  lastActivity: string;
}

interface FirebaseStorageConversation
  extends Omit<FirebaseConversation, 'metadata'> {
  metadata: FirebaseMetadata;
}

/**
 * Service for managing conversations in Firebase
 */
export class ConversationService extends BaseService {
  private static instance: ConversationService;

  private constructor() {
    super();
  }

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Create a new conversation session
   */
  async createSession(userId: string): Promise<ConversationSession> {
    const now = new Date();
    const metadata: ConversationMetadata = {
      userId,
      status: CONVERSATION_STATUS.active,
      startTime: now,
      lastActivity: now,
      messageCount: 0,
    };

    // Create a properly typed FirebaseMetadata object
    // This is needed for TypeScript, even though our BaseService will handle
    // the Date to string conversion automatically at runtime
    const firebaseMetadata: FirebaseMetadata = {
      ...metadata, // Copy all properties from metadata
      startTime: now.toISOString(), // Override with string version
      lastActivity: now.toISOString(), // Override with string version
    };

    const session: Partial<FirebaseStorageConversation> = {
      metadata: firebaseMetadata,
      messages: {},
      topics: {},
      summaries: {},
    };

    const conversationId = await this.pushData(
      FIREBASE_PATHS.conversations,
      session
    );

    return {
      id: conversationId,
      metadata,
      context: {
        immediate: [],
        currentTopic: {
          id: 'initial',
          startMessageId: '',
          themes: [],
          messageCount: 0,
          status: 'active',
          timestamp: now,
        },
      },
    };
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(
    conversationId: string,
    message: CreateMessage
  ): Promise<Message> {
    const messageId = await this.pushData(
      this.getConversationPath(conversationId, FIREBASE_PATHS.messages),
      message
    );

    // Update message count and last activity
    await this.updateData(
      this.getConversationPath(conversationId, 'metadata'),
      {
        lastActivity: new Date(),
        messageCount: (await this.getMessageCount(conversationId)) + 1,
      }
    );

    // Ensure timestamp is a Date object when returning
    return {
      ...message,
      id: messageId,
      timestamp: this.ensureValidDate(message.timestamp),
    };
  }

  /**
   * Get the last N messages from a conversation
   */
  async getLastMessages(
    conversationId: string,
    count: number = DEFAULT_CONVERSATION_CONFIG.immediateContextSize
  ): Promise<Message[]> {
    const messages = await this.getData<Record<string, CreateMessage>>(
      this.getConversationPath(conversationId, FIREBASE_PATHS.messages)
    );

    if (!messages) return [];

    const messageEntries = Object.entries(messages);
    const lastMessages = messageEntries.slice(-count);

    // Convert messages, ensuring timestamps are Date objects
    const convertMessage = ([id, msg]: [string, CreateMessage]): Message => ({
      ...msg,
      id,
      timestamp: this.ensureValidDate(msg.timestamp),
    });

    // If first message is a tool response, include the previous message
    if (lastMessages[0]?.[1].role === 'tool') {
      const previousMessage = messageEntries[messageEntries.length - count - 1];
      if (previousMessage) {
        return [
          convertMessage(previousMessage),
          ...lastMessages.map(convertMessage),
        ];
      }
    }

    return lastMessages.map(convertMessage);
  }

  /**
   * Check if a conversation exists
   */
  async exists(conversationId: string): Promise<boolean> {
    const conversationRef = this.getConversationPath(conversationId);
    const snapshot = await this.getData(conversationRef);
    return snapshot !== null;
  }

  /**
   * Get conversation metadata
   * @throws {Error} if conversation doesn't exist
   */
  async getMetadata(conversationId: string): Promise<ConversationMetadata> {
    const exists = await this.exists(conversationId);
    if (!exists) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const metadata = await this.getData<FirebaseMetadata>(
      this.getConversationPath(conversationId, FIREBASE_PATHS.metadata)
    );

    if (!metadata) {
      throw new Error(`Metadata corrupted for conversation ${conversationId}`);
    }

    // Convert from Firebase storage format to application type
    return {
      ...metadata,
      startTime: new Date(metadata.startTime),
      lastActivity: new Date(metadata.lastActivity),
    };
  }

  /**
   * Get a range of messages from a conversation
   */
  async getMessageRange(
    conversationId: string,
    startIndex: number,
    endIndex: number
  ): Promise<Message[]> {
    const messages = await this.getData(
      this.getConversationPath(conversationId, FIREBASE_PATHS.messages)
    );

    if (!messages) {
      return [];
    }

    // Convert messages, ensuring timestamps are Date objects
    const convertMessage = ([id, msg]: [string, CreateMessage]): Message => ({
      ...msg,
      id,
      timestamp: this.ensureValidDate(msg.timestamp),
    });

    // Convert to array and get range, preserving Firebase's natural chronological order
    const messageArray = Object.entries(messages).map(convertMessage);

    return messageArray.slice(startIndex, endIndex);
  }

  /**
   * Complete a conversation session
   */
  async completeSession(conversationId: string): Promise<void> {
    await this.updateData(
      this.getConversationPath(conversationId, 'metadata'),
      {
        status: CONVERSATION_STATUS.completed,
        lastActivity: new Date().toISOString(),
      }
    );
  }

  /**
   * Update conversation metadata
   */
  async updateMetadata(
    conversationId: string,
    updates: Partial<ConversationMetadata>
  ): Promise<void> {
    // Create a new object without date fields first
    const { startTime, lastActivity, ...otherUpdates } = updates;

    // Convert dates to ISO strings for Firebase storage
    const firebaseUpdates: Partial<FirebaseMetadata> = {
      ...otherUpdates,
      ...(startTime && { startTime: startTime.toISOString() }),
      ...(lastActivity && { lastActivity: lastActivity.toISOString() }),
    };

    await this.updateData(
      this.getConversationPath(conversationId, FIREBASE_PATHS.metadata),
      firebaseUpdates
    );
  }

  /**
   * Get messages that haven't been included in a summary yet
   */
  async getUnsummarizedMessages(conversationId: string): Promise<Message[]> {
    const messagesPath = this.getConversationPath(conversationId, FIREBASE_PATHS.messages);
    const snapshot = await this.getData<Record<string, CreateMessage>>(messagesPath);
    
    if (!snapshot) {
      logger.warn('No messages found for conversation', { conversationId });
      return [];
    }
    
    // Convert to array and filter for unsummarized messages
    const messageEntries = Object.entries(snapshot);
    const unsummarizedMessages = messageEntries
      .filter(([_, msg]) => msg.summarized !== true)
      .map(([id, msg]) => ({
        ...msg,
        id,
        timestamp: this.ensureValidDate(msg.timestamp),
      }));
    
    logger.debug('Retrieved unsummarized messages', { 
      conversationId, 
      count: unsummarizedMessages.length,
      totalMessages: messageEntries.length
    });
    
    return unsummarizedMessages;
  }

  /**
   * Get relevant context for the current conversation based on a query
   * @param conversationId The conversation ID
   * @param query The query to find relevant context for
   * @param options Options for context retrieval
   * @returns Formatted context string for inclusion in LLM prompt
   */
  async getRelevantContext(
    conversationId: string,
    query: string,
    options = { topK: 3 }
  ): Promise<string> {
    logger.info('Getting relevant context', {
      conversationId,
      queryPreview: query.substring(0, 50),
      topK: options.topK
    });
    
    try {
      // Get relevant summaries based on the query
      const summaries = await contextRetrievalService.getQueryBasedSummaries(
        query,
        conversationId,
        options
      );
      
      // Format summaries for inclusion in LLM context
      const formattedContext = contextRetrievalService.formatSummariesForContext(summaries);
      
      logger.info('Retrieved relevant context', {
        conversationId,
        summaryCount: summaries.length
      });
      
      return formattedContext;
    } catch (error) {
      logger.error('Error getting relevant context', {
        conversationId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return a default message on error
      return 'Unable to retrieve conversation context.';
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

  private async getMessageCount(conversationId: string): Promise<number> {
    const metadata = await this.getMetadata(conversationId);
    return metadata.messageCount;
  }

  /**
   * Get all active conversation sessions
   */
  async getActiveSessions(): Promise<ConversationSession[]> {
    const conversations = await this.getData<
      Record<string, FirebaseStorageConversation>
    >(FIREBASE_PATHS.conversations);

    if (!conversations) return [];

    return Object.entries(conversations)
      .filter(
        ([_, conv]) => conv.metadata.status === CONVERSATION_STATUS.active
      )
      .map(([id, conv]) => ({
        id,
        metadata: {
          ...conv.metadata,
          startTime: this.ensureValidDate(conv.metadata.startTime),
          lastActivity: this.ensureValidDate(conv.metadata.lastActivity),
        },
        context: {
          immediate: [],
          currentTopic: {
            id: 'initial',
            startMessageId: '',
            themes: [],
            messageCount: 0,
            status: 'active',
            timestamp: new Date(),
          },
        },
      }));
  }
}

// Export only the singleton instance
export const conversationService = ConversationService.getInstance();
