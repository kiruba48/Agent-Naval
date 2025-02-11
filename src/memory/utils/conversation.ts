import { Message, ChatMessage } from '../types/conversation';

/**
 * Convert our internal Message type to OpenAI's ChatMessage format
 */
export const toChatMessage = (message: Message): ChatMessage => {
    const chatMessage: ChatMessage = {
        role: message.role,
        content: message.content
    };
    
    if (message.name) {
        chatMessage.name = message.name;
    }
    
    if (message.function_call) {
        chatMessage.function_call = message.function_call;
    }
    
    return chatMessage;
};

/**
 * Convert OpenAI's ChatMessage to our internal Message format
 */
export const fromChatMessage = (message: ChatMessage, timestamp = new Date()): Message => {
    return {
        role: message.role,
        content: message.content,
        timestamp,
        name: message.name,
        function_call: message.function_call
    };
};
