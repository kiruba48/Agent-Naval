import { MessageProcessorConfig } from '../types/message';

export const MESSAGE_PROCESSOR_CONFIG: MessageProcessorConfig = {
  summaryChunkSize: 0, // Temporarily disable summary generation
  maxRetries: 3, // Maximum number of retries for failed operations
  retryDelayMs: 1000, // Delay between retries in milliseconds
};
