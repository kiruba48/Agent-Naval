import { z } from 'zod';
import type { ToolFn } from '../../types';
import { queryVectorStore } from '../vectorStore';

/**
 * Response schema for knowledge base queries
 */
const KnowledgeQueryResponse = z.object({
    results: z.array(z.object({
        id: z.string(),
        content: z.string(),
        relevance: z.number(),
        metadata: z.object({
            sourceFile: z.string(),
            title: z.string().optional(),
            author: z.string().optional(),
            chapter: z.string().optional(),
            themes: z.array(z.string())
        })
    })),
    totalResults: z.number()
});

export const knowledgeBaseToolDefinition = {
    name: 'queryKnowledgeBase',
    parameters: z.object({
        query: z.string().min(1).describe('The search query to find relevant information')
    }),
};

type Args = z.infer<typeof knowledgeBaseToolDefinition.parameters>;

export const queryKnowledgeBase: ToolFn<Args, z.infer<typeof KnowledgeQueryResponse>> = async ({ toolArgs, userMessage }) => {
    try {
        const { query } = toolArgs;
        const results = await queryVectorStore(query, 'naval');
        
        return {
            results: results.map(result => ({
                id: String(result.id),  // Convert id to string
                content: result.metadata.content,
                relevance: result.score,
                metadata: {
                    sourceFile: result.metadata.sourceFile,
                    title: result.metadata.title,
                    author: result.metadata.author,
                    chapter: result.metadata.chapter,
                    themes: result.metadata.themes
                }
            })),
            totalResults: results.length
        };
    } catch (error) {
        console.error('Error querying knowledge base:', error);
        throw new Error('Failed to query knowledge base');
    }
};
