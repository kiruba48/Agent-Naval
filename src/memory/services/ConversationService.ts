import { BaseService } from './BaseService';
import { 
    ConversationSession, 
    ConversationMetadata, 
    Message,
    CreateMessage,
    FirebaseConversation 
} from '../types';
import { 
    FIREBASE_PATHS, 
    CONVERSATION_STATUS,
    DEFAULT_CONVERSATION_CONFIG 
} from '../constants/config';
import { Timestamp } from 'firebase/firestore';

type FirebaseMetadata = Omit<ConversationMetadata, 'startTime' | 'lastActivity'> & {
    startTime: Timestamp;
    lastActivity: Timestamp;
};

/**
 * Service for managing conversations in Firebase
 */
class ConversationService extends BaseService {
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
        const metadata: ConversationMetadata = {
            userId,
            status: CONVERSATION_STATUS.active,
            startTime: new Date(),
            lastActivity: new Date(),
            messageCount: 0
        };

        const session: Partial<FirebaseConversation> = {
            metadata,
            messages: {},
            topics: {},
            summaries: {}
        };

        const conversationId = await this.pushData(FIREBASE_PATHS.conversations, session);
        
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
                    timestamp: new Date()
                }
            }
        };
    }

    /**
     * Add a message to the conversation
     */
    async addMessage(conversationId: string, message: CreateMessage): Promise<Message> {
        const messageId = await this.pushData(
            this.getConversationPath(conversationId, FIREBASE_PATHS.messages),
            message
        );

        // Update message count and last activity
        await this.updateData(
            this.getConversationPath(conversationId, 'metadata'),
            {
                lastActivity: new Date(),
                messageCount: (await this.getMessageCount(conversationId)) + 1
            }
        );

        return {
            ...message,
            id: messageId
        };
    }

    /**
     * Get the last N messages from a conversation
     */
    async getLastMessages(conversationId: string, count: number = DEFAULT_CONVERSATION_CONFIG.immediateContextSize): Promise<Message[]> {
        const messages = await this.getData<Record<string, CreateMessage>>(
            this.getConversationPath(conversationId, FIREBASE_PATHS.messages)
        );

        if (!messages) return [];

        return Object.entries(messages)
            .map(([messageId, messageData]) => ({
                ...messageData,
                id: messageId
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, count);
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
            // This should never happen if exists() returned true
            throw new Error(`Metadata corrupted for conversation ${conversationId}`);
        }

        // Convert Firestore timestamps to JavaScript Dates
        return {
            ...metadata,
            startTime: metadata.startTime.toDate(),
            lastActivity: metadata.lastActivity.toDate()
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

        // Convert to array and sort by timestamp
        const messageArray = Object.entries(messages)
            .map(([id, msg]) => ({ ...msg, id }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Get the specified range
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
                lastActivity: new Date()
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
        
        // Then construct firebaseUpdates with converted Timestamps
        const firebaseUpdates: Partial<FirebaseMetadata> = {
            ...otherUpdates,
            ...(startTime && { startTime: Timestamp.fromDate(startTime) }),
            ...(lastActivity && { lastActivity: Timestamp.fromDate(lastActivity) })
        };

        await this.updateData(
            this.getConversationPath(conversationId, FIREBASE_PATHS.metadata),
            firebaseUpdates
        );
    }

    private async getMessageCount(conversationId: string): Promise<number> {
        const metadata = await this.getMetadata(conversationId);
        return metadata.messageCount;
    }
}

// Export only the singleton instance
export const conversationService = ConversationService.getInstance();
