import { MessageProcessorConfig } from '../types/message';

export const MESSAGE_PROCESSOR_CONFIG: MessageProcessorConfig = {
    summaryChunkSize: 10,      // Generate summary every 10 messages (5 pairs)
    maxRetries: 3,             // Maximum number of retries for failed operations
    retryDelayMs: 1000,        // Delay between retries in milliseconds
};
