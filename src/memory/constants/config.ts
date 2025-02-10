import { ConversationConfig } from '../types';

/**
 * Default configuration for the conversation memory system
 */
export const DEFAULT_CONVERSATION_CONFIG: ConversationConfig = {
    immediateContextSize: 5,           // Keep last 5 messages in immediate context
    topicChangeThreshold: 0.7,         // Semantic similarity threshold for topic change
    summaryInterval: 10,               // Create summary every 10 messages
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

/**
 * Constants for Firebase paths
 */
export const FIREBASE_PATHS = {
    conversations: 'conversations',
    messages: 'messages',
    topics: 'topics',
    summaries: 'summaries',
    metadata: 'metadata'
} as const;

/**
 * Constants for summary types
 */
export const SUMMARY_TYPES = {
    recent: 'recent',
    global: 'global'
} as const;

/**
 * Constants for conversation status
 */
export const CONVERSATION_STATUS = {
    active: 'active',
    completed: 'completed'
} as const;
