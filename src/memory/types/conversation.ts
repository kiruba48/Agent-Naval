export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  id?: string;
  role: MessageRole;
  content: string | null; // Allow null for tool calls
  timestamp: Date;
  themes?: string[];
  embedding_id?: string;
  name?: string; // For tool messages
  tool_calls?: Array<{
    // For assistant messages that make tool calls
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string; // For tool messages responding to tool calls
}

/**
 * Message format optimized for summarization.
 * Excludes function calls and other metadata not needed for summarizing content.
 */
export interface SummaryReadyMessage {
  role: 'user' | 'assistant'; // Only user and assistant messages are relevant for summaries
  content: string | null; // The actual message content
  timestamp: Date; // When the message was sent
  themes?: string[]; // Themes associated with the message
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
  systemPrompt?: string; // Store system prompt at conversation level
}

export interface ConversationSession {
  id: string;
  metadata: ConversationMetadata;
}

export interface FirebaseConversation {
  metadata: ConversationMetadata;
  messages: { [messageId: string]: Message };
  topics: { [topicId: string]: any }; // Will be defined in topic types
  summaries: { [summaryId: string]: any }; // Will be defined in summary types
}

// Helper type for OpenAI chat completion format
export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}
