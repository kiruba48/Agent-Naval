import type { OpenAI } from 'openai';
import { knowledgeBaseToolDefinition, queryKnowledgeBase } from './tools';

export const runTool = async (
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    userMessage: string
  ) => {
    const input = {
      userMessage,
      toolArgs: JSON.parse(toolCall.function.arguments),
    }
    
    switch (toolCall.function.name) {
      case knowledgeBaseToolDefinition.name:
        return await queryKnowledgeBase(input);
        
      default:
        throw new Error(`Unknown tool: ${toolCall.function.name}`)
    }
  }