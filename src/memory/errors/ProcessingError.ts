import { MessageOperation, MessageProcessingErrorType } from '../types/message';

export class ProcessingError extends Error {
    constructor(
        public operation: MessageOperation,
        public error: Error
    ) {
        super(`Error during ${operation}: ${error.message}`);
        this.name = 'ProcessingError';
    }

    get type(): MessageProcessingErrorType {
        if (this.error.message.includes('not found')) {
            return MessageProcessingErrorType.CONVERSATION_NOT_FOUND;
        }
        if (this.error.message.includes('network')) {
            return MessageProcessingErrorType.NETWORK_ERROR;
        }
        if (this.error.message.includes('invalid')) {
            return MessageProcessingErrorType.INVALID_MESSAGE;
        }
        return MessageProcessingErrorType.STORAGE_ERROR;
    }
}
