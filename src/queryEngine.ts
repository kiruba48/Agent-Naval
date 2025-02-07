import { Index } from "@upstash/vector";
import dotenv from "dotenv";
import { GPT4, openai, generateEmbeddings } from './llm';

dotenv.config();

// Load and validate environment variables
const UPSTASH_VECTOR_REST_URL = process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_VECTOR_REST_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

if (!UPSTASH_VECTOR_REST_URL) throw new Error("Missing Upstash Vector REST URL!");
if (!UPSTASH_VECTOR_REST_TOKEN) throw new Error("Missing Upstash Vector REST Token!");

// Initialize Upstash Vector client
const vectorIndex = new Index({
    url: UPSTASH_VECTOR_REST_URL,
    token: UPSTASH_VECTOR_REST_TOKEN
});

/**
 * Retrieve the most relevant text chunks from Upstash Vector.
 */
async function findRelevantChunks(query: string, collectionName: string, topK = 3) {
    try {
        // Generate embedding for the query
        const queryEmbeddings = await generateEmbeddings([query]);
        if (!queryEmbeddings[0]) {
            throw new Error('Failed to generate query embedding');
        }

        // Query Upstash Vector
        const results = await vectorIndex.query({
            vector: queryEmbeddings[0],
            topK: topK,
            includeMetadata: true,
            includeVectors: false
        }, { namespace: collectionName });

        // Extract content from results
        return results.map(result => {
            if (!result.metadata || typeof result.metadata !== 'object') {
                console.warn(`Invalid metadata in result: ${result.id}`);
                return undefined;
            }
            return result.metadata.content;
        }).filter((content): content is string => content !== undefined);
    } catch (error) {
        console.error('Error querying vector store:', error);
        throw error;
    }
}

/**
 * Generates an answer using GPT-4 based on retrieved chunks.
 */
export async function answerQuery(query: string, collectionName: string) {
    const systemPrompt = `You are a helpful AI assistant answering questions about Naval Ravikant's reading list.
    Use the following context to answer the question. If you cannot answer based on the context, say so.
    Don't mention that you're using any specific context - just answer naturally.`;
    
    const relevantChunks = await findRelevantChunks(query, collectionName);
    console.log("Retrieved Context:", relevantChunks.join("\n\n"));

    const response = await openai.chat.completions.create({
        model: GPT4,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Use the following context to answer:\n\n${relevantChunks.join("\n\n")}\n\nQuestion: ${query}` },
        ],
        temperature: 0.6,
        max_tokens: 500,
    });

    console.log("Answer:", response.choices[0].message.content);
    return response.choices[0].message.content;
}
