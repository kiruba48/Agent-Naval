import { OpenAI } from "openai";
import 'dotenv/config';

// Load and validate OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

// Initialize OpenAI client
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Common models
export const GPT4 = "gpt-4o-mini";
export const GPT35_TURBO = "gpt-3.5-turbo";
export const TEXT_EMBEDDING = "text-embedding-3-small";

// Helper function for text generation
export async function generateText(prompt: string, model = GPT4) {
    const completion = await openai.chat.completions.create({
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
    });
    return response.data.map(item => item.embedding);
}