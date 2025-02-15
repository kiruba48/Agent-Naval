import { OpenAI } from "openai";
import { zodFunction } from 'openai/helpers/zod'
import { z } from 'zod'
import 'dotenv/config';
import type { AIMessage } from '../types';

// Load and validate OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HYPERBOLIC_API_KEY = process.env.HYPERBOLIC_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");
if (!HYPERBOLIC_API_KEY) throw new Error("Missing Hyperbolic API Key!");

// Initialize OpenAI client
export const llm_client = new OpenAI({ 
    apiKey: HYPERBOLIC_API_KEY,
    baseURL: 'https://api.hyperbolic.xyz/v1',
});

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Common models
export const GPT4 = "gpt-4o-mini";
export const GPT35_TURBO = "gpt-3.5-turbo";
export const DEEPSEEK_R1 = "deepseek-ai/DeepSeek-R1";
export const DEEPSEEK_V3 = "deepseek-ai/DeepSeek-V3";
export const LLAMA_70B = "meta-llama/Llama-3.3-70B-Instruct";
export const TEXT_EMBEDDING = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1024;

// System prompt for the agent
const systemPrompt = `You are Naval Agent, an AI assistant focused on helping users understand Naval Ravikant's teachings and philosophy.
Your responses should be clear, concise, and grounded in Naval's actual teachings and writings.
When using tools, focus on finding and providing the most relevant information from Naval's content.`;

/**
 * Run LLM with tool support
 */
export const runLLM = async ({
    model = GPT4,
    messages,
    temperature = 0.1,
    tools,
}: {
    messages: AIMessage[]
    temperature?: number
    model?: string
    tools?: { name: string; parameters: z.AnyZodObject }[]
}) => {
    const formattedTools = tools?.map((tool) => zodFunction(tool));
    const response = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            ...messages,
        ],
        temperature,
        tools: formattedTools,
        tool_choice: 'auto',
        parallel_tool_calls: false,
    });

    return response.choices[0].message;
};

// Helper function for text generation
export async function generateText(prompt: string, model = LLAMA_70B) {
    const completion = await llm_client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: model,
        temperature: 0,
    });
    return completion.choices[0].message.content || "";
}

// Helper function for embeddings
export async function generateEmbeddings(texts: string[]) {
    const response = await openai.embeddings.create({
        model: TEXT_EMBEDDING,
        input: texts,
        dimensions: EMBEDDING_DIMENSION,
    });
    return response.data.map(item => item.embedding);
}