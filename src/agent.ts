import type { AIMessage } from '../types'
import { runLLM } from './llm'
import { z } from 'zod'
import { runTool } from './toolRunner'
import { messageProcessor } from './memory/services/initializeServices'
import { conversationService } from './memory/services/ConversationService'
import { logMessage, showLoader } from './ui'
import { logger } from './utils/logger'

/**
 * Run the Naval Agent with tool support
 */
export const runAgent = async ({
    userMessage,
    tools = [],
    conversationId,
}: {
    userMessage: string
    tools?: { name: string; parameters: z.AnyZodObject }[]
    conversationId: string
}) => {
    const loader = showLoader('Thinking...');

    try {
        // Add user message to conversation history
        await messageProcessor.addMessage(conversationId, {
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        });

        while (true) {
            // Get conversation history
            const history = await conversationService.getLastMessages(conversationId);

            logger.debug('Conversation history for OpenAI', { 
                history_length: history.length,
                last_message: history[history.length - 1],
                tool_calls: history.filter(msg => msg.role === 'assistant' && msg.tool_calls).length,
                tool_responses: history.filter(msg => msg.role === 'tool').length
            });

            // Get LLM response
            const response = await runLLM({
                messages: history,
                tools
            });

            logger.debug('Raw LLM Response', {
                response: JSON.stringify(response, null, 2)
            });

            logger.debug('LLM Response', {
                has_content: !!response.content,
                has_tool_calls: !!response.tool_calls,
                tool_calls_count: response.tool_calls?.length
            });

            // Save raw LLM response to conversation history
            await messageProcessor.addMessage(conversationId, {
                ...response,
                timestamp: new Date()
            });

            // First check if we have a direct answer
            if (response.content) {
                logger.debug('Processing assistant message', { content: response.content });
                logMessage(response);
                loader.stop();
                return response.content;
            }

            // Handle tool calls
            if (response.tool_calls) {
                const toolCall = response.tool_calls[0];
                logger.debug('Processing tool call', {
                    tool_name: toolCall.function.name,
                    args: toolCall.function.arguments
                });
                loader.update(`executing: ${toolCall.function.name}`);

                try {
                    const toolResponse = await runTool(toolCall, userMessage);
                    logger.debug('Tool response received', {
                        tool_name: toolCall.function.name,
                        response: toolResponse
                    });

                    // Save tool response to conversation history
                    await messageProcessor.addMessage(conversationId, {
                        role: 'tool',
                        content: JSON.stringify(toolResponse),
                        name: toolCall.function.name,
                        tool_call_id: toolCall.id,
                        timestamp: new Date()
                    });

                    loader.update(`executed: ${toolCall.function.name}`);
                } catch (error) {
                    logger.error('Tool execution failed', {
                        error: error instanceof Error ? error.message : String(error),
                        tool_name: toolCall.function.name
                    });
                    loader.stop();
                    return `I encountered an error while trying to answer your question: ${error instanceof Error ? error.message : String(error)}`;
                }
            }
        }
    } catch (error) {
        loader.stop();
        logger.error('Agent execution failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}