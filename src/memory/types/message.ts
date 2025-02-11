import { Message } from './conversation';

export interface MessagePair {
    userMessage: Message;
    assistantMessage: Message;
    timestamp: Date;
}

// Different operations that can be performed on messages
export enum MessageOperation {
    STORE_MESSAGE = 'STORE_MESSAGE',         // Adding messages to storage
    UPDATE_METADATA = 'UPDATE_METADATA',      // Updating conversation metadata
    GENERATE_SUMMARY = 'GENERATE_SUMMARY',    // Generating conversation summary
    GET_METADATA = 'GET_METADATA'            // Retrieving conversation metadata
}

// Error types for message processing
export enum MessageProcessingErrorType {
    CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',    // Conversation doesn't exist
    INVALID_MESSAGE = 'INVALID_MESSAGE',                  // Message format/content invalid
    STORAGE_ERROR = 'STORAGE_ERROR',                      // Error storing data
    NETWORK_ERROR = 'NETWORK_ERROR'                       // Network/connection issues
}

export interface ProcessingError {
    operation: MessageOperation;              // What operation was being performed
    type: MessageProcessingErrorType;         // Type of error that occurred
    error: Error;                             // The actual error object
}

export interface ProcessingResult {
    success: boolean;
    messageIds: string[];
    summaryPending: boolean;  // Indicates if summary generation was triggered
    error?: ProcessingError;
}

export interface MessageProcessorConfig {
    summaryChunkSize: number;
    maxRetries: number;
    retryDelayMs: number;
}
