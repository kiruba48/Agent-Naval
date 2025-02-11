export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

export interface Message {
    id?: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    themes?: string[];
    embedding_id?: string;
    name?: string;  // For function messages
    function_call?: {  // For assistant messages that call functions
        name: string;
        arguments: string;
    };
}

export interface ConversationContext {
    systemPrompt: string;
    relevantSummaries?: string[];
    recentMessages: Message[];
}

export interface ConversationMetadata {
    userId: string;
    status: 'active' | 'ended';
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
    systemPrompt?: string;  // Store system prompt at conversation level
}

export interface ConversationSession {
    id: string;
    metadata: ConversationMetadata;
}

export interface FirebaseConversation {
    metadata: ConversationMetadata;
    messages: { [messageId: string]: Message };
    topics: { [topicId: string]: any };  // Will be defined in topic types
    summaries: { [summaryId: string]: any };  // Will be defined in summary types
}

// Helper type for OpenAI chat completion format
export interface ChatMessage {
    role: MessageRole;
    content: string;
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}
