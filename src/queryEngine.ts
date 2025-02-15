import { tools } from './tools';
import { runAgent } from './agent';
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

/**
 * Answers a query using the Naval Agent with knowledge base tool support.
 * The agent can search through Naval's content and provide relevant answers.
 */
export async function answerQuery(
    query: string, 
    conversationId: string,
    structured: boolean = false
): Promise<string | StructuredAnswer> {
    try {
        // Run the agent with knowledge base tool
        const response = await runAgent({
            userMessage: query,
            tools,
            conversationId
        });

        // If structured response requested, try to parse it
        if (structured && response) {
            try {
                return JSON.parse(response) as StructuredAnswer;
            } catch (error) {
                console.error("Failed to parse structured response:", error);
                return response; // Fallback to string response
            }
        }

        return response || "";
    } catch (error) {
        console.error('Error in answerQuery:', error);
        throw error;
    }
}
