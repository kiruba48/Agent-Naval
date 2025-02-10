import { BaseService } from './BaseService';
import { TopicSegment, Message } from '../types';
import { FIREBASE_PATHS, DEFAULT_CONVERSATION_CONFIG } from '../constants/config';
import { conversationService } from './ConversationService';

/**
 * Service for managing topic detection and segmentation
 */
class TopicService extends BaseService {
    private static instance: TopicService;

    private constructor() {
        super();
    }

    public static getInstance(): TopicService {
        if (!TopicService.instance) {
            TopicService.instance = new TopicService();
        }
        return TopicService.instance;
    }

    /**
     * Create a new topic segment
     */
    async createTopicSegment(
        conversationId: string,
        startMessageId: string,
        themes: string[]
    ): Promise<TopicSegment> {
        const segment: TopicSegment = {
            id: '',  // Will be set by Firebase
            startMessageId,
            themes,
            messageCount: 1,
            status: 'active',
            timestamp: new Date()
        };

        const segmentId = await this.pushData(
            this.getConversationPath(conversationId, FIREBASE_PATHS.topics),
            segment
        );

        return {
            ...segment,
            id: segmentId
        };
    }

    /**
     * Complete a topic segment
     */
    async completeTopicSegment(
        conversationId: string,
        topicId: string,
        endMessageId: string,
        summary?: string
    ): Promise<void> {
        await this.updateData(
            this.getConversationPath(conversationId, `${FIREBASE_PATHS.topics}/${topicId}`),
            {
                endMessageId,
                status: 'completed',
                summary
            }
        );
    }

    /**
     * Check if a new message indicates a topic change
     */
    async detectTopicChange(
        conversationId: string,
        newMessage: Message,
        currentTopicId: string
    ): Promise<boolean> {
        const currentTopic = await this.getTopic(conversationId, currentTopicId);
        if (!currentTopic) return true;

        // Get recent messages for context
        const recentMessages = await conversationService.getLastMessages(
            conversationId,
            DEFAULT_CONVERSATION_CONFIG.immediateContextSize
        );

        // TODO: Implement semantic similarity check
        const similarityScore = await this.calculateSimilarity(newMessage, recentMessages);
        
        return similarityScore < DEFAULT_CONVERSATION_CONFIG.topicChangeThreshold;
    }

    /**
     * Get a topic segment
     */
    async getTopic(conversationId: string, topicId: string): Promise<TopicSegment | null> {
        return this.getData<TopicSegment>(
            this.getConversationPath(conversationId, `${FIREBASE_PATHS.topics}/${topicId}`)
        );
    }

    /**
     * Update topic message count
     */
    async incrementMessageCount(conversationId: string, topicId: string): Promise<void> {
        const topic = await this.getTopic(conversationId, topicId);
        if (!topic) return;

        await this.updateData(
            this.getConversationPath(conversationId, `${FIREBASE_PATHS.topics}/${topicId}`),
            {
                messageCount: topic.messageCount + 1
            }
        );
    }

    /**
     * Calculate similarity between new message and recent context
     * This is a placeholder for the actual implementation
     */
    private async calculateSimilarity(newMessage: Message, context: Message[]): Promise<number> {
        // TODO: Implement actual similarity calculation using embeddings
        // For now, return a default value
        return 1.0;
    }
}

// Export singleton instance
export const topicService = TopicService.getInstance();
