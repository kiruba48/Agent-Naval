import type { AIMessage } from '../types';
import { runLLM } from './llm';
import { z } from 'zod';
import { runTool } from './toolRunner';
import { messageProcessor } from './memory/services/initializeServices';
import { conversationService } from './memory/services/ConversationService';
import { logMessage, showLoader } from './ui';
import { logger } from './utils/logger';

/**
 * Run the Naval Agent with tool support
 */
const MAX_TOOL_CALLS = 3;
const TIMEOUT_MS = 30000; // 30 seconds

export const runAgent = async ({
  userMessage,
  tools = [],
  conversationId,
}: {
  userMessage: string;
  tools?: { name: string; parameters: z.AnyZodObject }[];
  conversationId: string;
}) => {
  const loader = showLoader('Thinking...');
  const startTime = Date.now();
  let toolCallCount = 0;

  try {
    // Add user message to conversation history
    await messageProcessor.addMessage(conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    while (true) {
      // Get conversation history
      const history = await conversationService.getLastMessages(conversationId);

      //   logger.debug('Conversation history structure', {
      //     messages: history.map((msg) => ({
      //       role: msg.role,
      //       has_tool_calls: !!msg.tool_calls,
      //       has_content: !!msg.content,
      //       tool_calls_count: msg.tool_calls?.length,
      //     })),
      //   });

      //   logger.debug('Conversation history for OpenAI', {
      //     history_length: history.length,
      //     last_message: history[history.length - 1],
      //     tool_calls: history.filter(
      //       (msg) => msg.role === 'assistant' && msg.tool_calls
      //     ).length,
      //     tool_responses: history.filter((msg) => msg.role === 'tool').length,
      //   });

      // Get LLM response
      const response = await runLLM({
        messages: history,
        tools,
      });

      //   logger.debug('Raw LLM Response', {
      //     response: JSON.stringify(response, null, 2),
      //   });

      //   logger.debug('LLM Response', {
      //     has_content: !!response.content,
      //     has_tool_calls: !!response.tool_calls,
      //     tool_calls_count: response.tool_calls?.length,
      //   });

      // Save raw LLM response to conversation history
      await messageProcessor.addMessage(conversationId, {
        ...response,
        timestamp: new Date(),
      });

      // First check if we have a direct answer
      if (response.content) {
        // logger.debug('Processing assistant message', {
        //   content: response.content,
        // });
        // logMessage(response);
        loader.stop();
        return response.content;
      }

      // Check timeout and tool call limits
      if (Date.now() - startTime > TIMEOUT_MS) {
        logger.warn('Request timeout', {
          conversationId,
          elapsed: Date.now() - startTime,
        });
        loader.stop();
        return 'Request timed out after 30 seconds. Please try rephrasing your question.';
      }

      // Handle tool calls
      if (response.tool_calls) {
        toolCallCount++;
        if (toolCallCount > MAX_TOOL_CALLS) {
          logger.warn('Max tool calls exceeded', {
            conversationId,
            toolCallCount,
          });
          loader.stop();
          return 'Maximum tool calls (3) reached. Please try a different approach.';
        }

        for (const toolCall of response.tool_calls) {
          logger.debug('Processing tool call', {
            tool: toolCall.function.name,
            args: toolCall.function.arguments,
          });

          const result = await runTool(toolCall, userMessage);

          // Format the tool response into a string
          const formattedResult =
            typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2);

          // Add tool response with proper structure
          await messageProcessor.addMessage(conversationId, {
            role: 'tool',
            name: toolCall.function.name,
            content: formattedResult,
            timestamp: new Date(),
            tool_call_id: toolCall.id, // Important: Link response to specific tool call
          });
        }
      }
    }
  } catch (error) {
    loader.stop();
    logger.error('Agent execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
