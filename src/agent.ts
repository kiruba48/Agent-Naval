import type { AIMessage } from '../types'
import { runLLM } from './llm'
import { z } from 'zod'
import { runTool } from './toolRunner'
import { messageProcessor } from './memory/services/MessageProcessor'
import { conversationService } from './memory/services/ConversationService'
import { logMessage, showLoader } from './ui'

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
    // Process user message
    await messageProcessor.addMessage(conversationId, {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
    });

    const loader = showLoader('Thinking...');

    try {
        while (true) {
            // Get conversation history
            const history = (await conversationService.getLastMessages(conversationId))
                .map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    tool_calls: msg.toolCalls,
                    tool_call_id: msg.toolCallId
                })) as AIMessage[];

            // Get LLM response
            const response = await runLLM({
                messages: history,
                tools,
            });

            // Process assistant message
            if (response.content) {
                await messageProcessor.addMessage(conversationId, {
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date()
                });
                logMessage(response);
                loader.stop();
                return response.content;
            }

            // Handle tool calls
            if (response.tool_calls) {
                const toolCall = response.tool_calls[0];
                loader.update(`executing: ${toolCall.function.name}`);

                const toolResponse = await runTool(toolCall, userMessage);

                // Save tool response as assistant message with tool_call_id
                await messageProcessor.addMessage(conversationId, {
                    role: 'assistant',
                    content: JSON.stringify(toolResponse),
                    timestamp: new Date(),
                    toolCallId: toolCall.id
                });

                loader.update(`executed: ${toolCall.function.name}`);
            }
        }
    } catch (error) {
        loader.stop();
        throw error;
    }
}