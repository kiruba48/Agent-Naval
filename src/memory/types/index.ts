/**
 * Core type definitions for the conversation memory system
 */

/**
 * Base types for creation of entities
 */
export interface CreateMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    themes?: string[];
    embedding?: number[];
}

export interface CreateSummary {
    level: 'recent' | 'global';
    content: string;
    themes: string[];
    timestamp: Date;
    segmentIds?: string[];
    metadata?: {
        significantInsights?: string[];
        userPreferences?: Record<string, number>;
    }
}

/**
 * Stored entity types (with IDs)
 */
export interface Message extends CreateMessage {
    id: string;
}

export interface TopicSegment {
    id: string;
    startMessageId: string;
    endMessageId?: string;
    themes: string[];
    summary?: string;
    messageCount: number;
    status: 'active' | 'completed';
    timestamp: Date;
}

export interface ConversationSummary extends CreateSummary {
    id: string;
}

/**
 * Represents the metadata for a conversation session
 */
export interface ConversationMetadata {
    userId: string;
    status: 'active' | 'completed';
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
    currentTopicId?: string;
}

/**
 * Represents a complete conversation session
 */
export interface ConversationSession {
    id: string;
    metadata: ConversationMetadata;
    context: {
        immediate: Message[];      // Last 5 messages
        currentTopic: TopicSegment;
        recentSummary?: ConversationSummary;
        globalSummary?: ConversationSummary;
    }
}

/**
 * Represents the structure of conversations in Firebase
 */
export interface FirebaseConversation {
    metadata: ConversationMetadata;
    messages: Record<string, CreateMessage>;
    topics: Record<string, TopicSegment>;
    summaries: Record<string, CreateSummary>;
}

/**
 * Configuration for the conversation system
 */
export interface ConversationConfig {
    immediateContextSize: number;     // Number of messages in immediate context
    topicChangeThreshold: number;     // Threshold for topic change detection
    summaryInterval: number;          // Number of messages before creating a summary
    sessionTimeout: number;           // Session timeout in milliseconds
}
