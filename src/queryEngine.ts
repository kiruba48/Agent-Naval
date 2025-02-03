import { OpenAI } from "openai";
import { ChromaClient } from "chromadb";
import dotenv from "dotenv";

dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const chroma = new ChromaClient(); // Connects to local ChromaDB instance

/**
 * Retrieve the most relevant text chunks from ChromaDB.
 */
async function findRelevantChunks(query: string, collectionName: string, topK = 3) {
    const collection = await chroma.getCollection({ name: collectionName });

    const queryEmbedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const results = await collection.query({
        queryEmbeddings: [queryEmbedding.data[0].embedding],
        nResults: topK,
    });

    return results.metadatas?.flatMap((meta) => meta?.text) ?? [];
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
        model: "gpt-4o-mini",
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
