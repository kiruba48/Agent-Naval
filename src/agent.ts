import type { AIMessage } from '../types';
import { runLLM } from './llm';
import { z } from 'zod';
import { runTool } from './toolRunner';
import { messageProcessor } from './memory/services/initializeServices';
import { conversationService } from './memory/services/ConversationService';
import { logMessage, showLoader } from './ui';
import { logger } from './utils/logger';
import { systemPrompt } from './systemPrompt';
import { DEFAULT_CONVERSATION_CONFIG } from './memory/constants/config';

/**
 * Run the Naval Agent with tool support
 * 
 * Memory Hierarchy:
 * 1. Immediate Context: Last 5 messages (always available)
 * 2. Vector-Based Context: Summaries of previous conversations (only after 10+ messages)
 * 
 * The agent always has access to the immediate context. Vector-based context is only
 * retrieved and included in the system prompt after enough messages have been processed
 * to generate summaries (defined by DEFAULT_CONVERSATION_CONFIG.summaryInterval).
 */
const MAX_TOOL_CALLS = 3;
const TIMEOUT_MS = 30000; // 30 seconds
const systemPromptValue = systemPrompt;

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

    // Get conversation metadata to check message count
    const metadata = await conversationService.getMetadata(conversationId);
    
    // Initialize relevant context
    let relevantContext = '';
    
    // Only retrieve vector-based context if we have enough messages for summaries to exist
    if (metadata.messageCount >= DEFAULT_CONVERSATION_CONFIG.summaryInterval) {
      logger.debug('Retrieving vector-based context', {
        conversationId,
        messageCount: metadata.messageCount
      });
      
      relevantContext = await conversationService.getRelevantContext(
        conversationId,
        userMessage,
        { topK: 3 }
      );
      
      logger.debug('Retrieved vector-based context', {
        conversationId,
        contextLength: relevantContext.length,
        preview: relevantContext.substring(0, 100) + (relevantContext.length > 100 ? '...' : '')
      });
    } else {
      logger.debug('Skipping vector-based context retrieval (not enough messages)', {
        conversationId,
        messageCount: metadata.messageCount,
        summaryThreshold: DEFAULT_CONVERSATION_CONFIG.summaryInterval
      });
    }

    // Create a dynamic system prompt that includes the context if available
    let dynamicSystemPrompt = systemPromptValue;
    if (relevantContext.trim()) {
      dynamicSystemPrompt += `\n\n### Relevant Context From Previous Conversations\n${relevantContext}\n\nUse the above context to inform your responses when relevant.`;
    }

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
        customSystemPrompt: dynamicSystemPrompt,
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
        // Process pending messages to ensure summaries are generated
        await messageProcessor.processPendingMessages(conversationId);

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
