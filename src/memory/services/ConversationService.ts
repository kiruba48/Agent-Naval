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
     * Get conversation metadata
     */
    async getMetadata(conversationId: string): Promise<ConversationMetadata | null> {
        return this.getData<ConversationMetadata>(
            this.getConversationPath(conversationId, FIREBASE_PATHS.metadata)
        );
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

    private async getMessageCount(conversationId: string): Promise<number> {
        const metadata = await this.getMetadata(conversationId);
        return metadata?.messageCount || 0;
    }
}

// Export singleton instance
export const conversationService = ConversationService.getInstance();
