import { openai, GPT4 } from './llm';
import { queryVectorStore } from './vectorStore';
import dotenv from "dotenv";

dotenv.config();

export interface StructuredAnswer {
    answer: string;                 // The main answer text
    confidence: number;             // Confidence score between 0 and 1
    sources: {                      // Sources used in the answer
        content: string;
        relevance: number;
    }[];
    topics: string[];              // Main topics/themes discussed in the answer
}

interface VectorSearchResult {
    id: string | number;
    score: number;
    metadata: {
        content: string;
        sourceFile: string;
        title?: string;
        author?: string;
        chapter?: string;
        themes: string[];
    };
}

/**
 * Retrieve the most relevant text chunks from Upstash Vector.
 */
async function findRelevantChunks(query: string, collectionName: string, topK = 3): Promise<string[]> {
    try {
        const results = await queryVectorStore(query, collectionName) as VectorSearchResult[];
        return results.map(result => result.metadata.content);
    } catch (error) {
        console.error('Error querying vector store:', error);
        throw error;
    }
}

/**
 * Generates an answer using GPT-4 based on retrieved chunks.
 */
export async function answerQuery(
    query: string, 
    collectionName: string,
    structured: boolean = false
): Promise<string | StructuredAnswer> {
    const systemPrompt = structured ? 
        `You are a helpful AI assistant answering questions about Naval Ravikant's reading list.
        IMPORTANT: Do NOT repeat or include the provided context in your response.
        Instead, synthesize the information from the context to provide a clear, direct answer.
        
        You MUST return your response in the following JSON format:
        {
            "answer": "your direct answer here, without repeating the context",
            "confidence": 0.95, // between 0 and 1, based on how confident you are in the answer
            "sources": [
                {
                    "content": "brief relevant quote that supports your answer",
                    "relevance": 0.9 // between 0 and 1, how relevant this quote is
                }
            ],
            "topics": ["topic1", "topic2"] // main topics/themes discussed
        }` :
        `You are a helpful AI assistant answering questions about Naval Ravikant's reading list.
        IMPORTANT: Do NOT repeat or include the provided context in your response.
        Instead, synthesize the information to provide a clear, direct answer.`;
    
    const relevantChunks = await findRelevantChunks(query, collectionName);
    
    // Format and log the context chunks clearly
    console.log("\n📚 Retrieved Context:");
    relevantChunks.forEach((chunk, index) => {
        console.log(`\nChunk ${index + 1}:`);
        console.log("----------------------------------------");
        console.log(chunk);
        console.log("----------------------------------------");
    });

    const response = await openai.chat.completions.create({
        model: GPT4,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Use the following context to answer:\n\n${relevantChunks.join("\n\n")}\n\nQuestion: ${query}` },
        ],
        response_format: structured ? { type: "json_object" } : undefined,
        temperature: 0.2,
        max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    
    if (structured && content) {
        try {
            return JSON.parse(content) as StructuredAnswer;
        } catch (error) {
            console.error("Failed to parse structured response:", error);
            // Fallback to unstructured response
            return content;
        }
    }

    return content || "";
}
