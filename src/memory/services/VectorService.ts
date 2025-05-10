import { BaseService } from './BaseService';
import { logger } from '../../utils/logger';
import { VectorMetadata, VectorStoreError, VectorStoreErrorType } from '../types/vector';
import { Index, WeightingStrategy, FusionAlgorithm, QueryMode, QueryResult } from '@upstash/vector';
import { VECTOR_INDICES } from '../constants/vector';

interface QueryOptions {
    topK?: number;
    filter?: {
        userId?: string;
        sessionId?: string;
        conversationId?: string;
        timeRange?: {
            start: Date;
            end: Date;
        };
    };
}

interface SimilaritySearchResult {
    id: string;
    score: number;
    vector: number[];
    metadata: VectorMetadata;
    data?: string;
}

/**
 * Service for managing vector storage and retrieval using Upstash Vector
 */
class VectorService extends BaseService {
    private static instance: VectorService;
    private indices: Map<string, Index> = new Map();

    private constructor() {
        super();
        this.initializeIndices();
    }

    public static getInstance(): VectorService {
        if (!VectorService.instance) {
            VectorService.instance = new VectorService();
        }
        return VectorService.instance;
    }

    /**
     * Initialize vector indices
     */
    private initializeIndices(): void {
        Object.entries(VECTOR_INDICES).forEach(([name, config]) => {
            this.indices.set(
                name,
                new Index({
                    url: config.url,
                    token: config.token
                })
            );
        });
    }

    /**
     * Get or initialize an index
     */
    private async getIndex(indexName: string): Promise<Index> {
        // First try exact match
        let index = this.indices.get(indexName);
        if (!index) {
            // Try case-insensitive match
            const upperIndexName = indexName.toUpperCase();
            const configKey = Object.keys(VECTOR_INDICES).find(
                key => key.toUpperCase() === upperIndexName
            );
            
            if (!configKey) {
                throw new Error(`Vector index ${indexName} not found in configuration`);
            }
            
            const config = VECTOR_INDICES[configKey];
            index = new Index({
                url: config.url,
                token: config.token
            });
            
            // Store with the original indexName for future lookups
            this.indices.set(indexName, index);
            
            logger.info(`Initialized vector index ${indexName} using config for ${configKey}`);
        }
        return index;
    }

    /**
     * Upsert a vector into the specified index
     * For conversation summaries, Upstash will generate embeddings
     * For knowledge base, we generate embeddings using OpenAI
     */
    async upsertVector(
        indexName: string,
        data: {
            text: string;
            metadata?: VectorMetadata;
            embedding?: number[];  // Required for knowledge base index
        }
    ): Promise<string> {
        const startTime = Date.now();
        const vectorId = crypto.randomUUID();

        try {
            const index = await this.getIndex(indexName);
            const isConversationIndex = indexName === VECTOR_INDICES.CONVERSATIONS.name;

            if (!isConversationIndex && !data.embedding) {
                throw new Error('Embedding required for non-conversation indices');
            }

            // For conversation summaries, let Upstash generate embeddings
            // For knowledge base, use provided OpenAI embeddings
            if (isConversationIndex) {
                await index.upsert([{
                    id: vectorId,
                    data: data.text,  // Upstash will generate embedding
                    metadata: data.metadata
                }]);
            } else {
                // For knowledge base, use pre-generated embeddings
                if (!data.embedding) {
                    throw new Error('Embedding required for knowledge base index');
                }
                await index.upsert([{
                    id: vectorId,
                    vector: data.embedding,  // Use pre-generated embedding
                    metadata: data.metadata
                }]);
            }

            logger.info('Vector upserted successfully', {
                indexName,
                vectorId,
                isConversationIndex,
                timing: Date.now() - startTime
            });

            return vectorId;
        } catch (error) {
            logger.error('Failed to upsert vector', {
                indexName,
                error: error instanceof Error ? error.message : String(error),
                timing: Date.now() - startTime
            });
            throw this.handleVectorError(error);
        }
    }

    /**
     * Execute a similarity search query
     */
    private async executeQuery(
        index: Index,
        query: string | number[],
        options: QueryOptions = {}
    ): Promise<QueryResult[]> {
        try {
            const baseOptions: {
                topK: number;
                includeMetadata: boolean;
                includeVectors: boolean;
                includeData: boolean;
                filter?: string;
            } = {
                topK: options.topK || 5,
                includeMetadata: true,
                includeVectors: false,
                includeData: true
            };

            if (options.filter) {
                // Convert filter object to Upstash filter string
                const filters: string[] = [];
                if (options.filter.userId) {
                    filters.push(`metadata.userId = "${options.filter.userId}"`);
                }
                if (options.filter.sessionId) {
                    filters.push(`metadata.sessionId = "${options.filter.sessionId}"`);
                }
                if (options.filter.conversationId) {
                    filters.push(`metadata.conversationId = "${options.filter.conversationId}"`);
                }
                if (options.filter.timeRange) {
                    filters.push(
                        `metadata.timestamp >= "${options.filter.timeRange.start.toISOString()}"`,
                        `metadata.timestamp <= "${options.filter.timeRange.end.toISOString()}"`
                    );
                }
                if (filters.length > 0) {
                    baseOptions.filter = filters.join(' AND ');
                }
            }

            // For conversation index, use text input
            // For knowledge base, use vector
            const results = Array.isArray(query)
                ? await index.query({
                    ...baseOptions,
                    vector: query,
                    queryMode: QueryMode.DENSE
                })
                : await index.query({
                    ...baseOptions,
                    data: query,
                    queryMode: QueryMode.DENSE  // Changed from HYBRID to DENSE for better results
                });

            return Array.isArray(results) ? results : [results];
        } catch (error) {
            logger.error('Query execution failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw this.handleVectorError(error);
        }
    }

    /**
     * Process query results into a standardized format
     */
    private processQueryResults(results: QueryResult[]): SimilaritySearchResult[] {
        return results.map(result => ({
            id: String(result.id),
            score: result.score,
            vector: result.vector || [],
            metadata: result.metadata as VectorMetadata,
            data: result.data
        }));
    }

    /**
     * Query for similar vectors using text or vector input
     */
    async querySimilar(
        indexName: string,
        input: string | number[],
        options?: QueryOptions
    ): Promise<SimilaritySearchResult[]> {
        const startTime = Date.now();
        try {
            const index = await this.getIndex(indexName);
            const isConversationIndex = indexName === VECTOR_INDICES.CONVERSATIONS.name;

            // For knowledge base queries, ensure we have a vector
            if (!isConversationIndex && typeof input === 'string') {
                throw new Error('Vector input required for knowledge base queries');
            }

            const results = await this.executeQuery(index, input, options);
            const processedResults = this.processQueryResults(results);

            logger.info('Similarity search completed', {
                indexName,
                resultCount: processedResults.length,
                timing: Date.now() - startTime
            });

            return processedResults;
        } catch (error) {
            logger.error('Similarity search failed', {
                indexName,
                error: error instanceof Error ? error.message : String(error),
                timing: Date.now() - startTime
            });
            throw this.handleVectorError(error);
        }
    }

    /**
     * Delete vectors by their IDs
     */
    async deleteVectors(indexName: string, ids: string[]): Promise<void> {
        const startTime = Date.now();
        try {
            const index = await this.getIndex(indexName);
            await index.delete(ids);

            logger.info('Vectors deleted successfully', {
                indexName,
                count: ids.length,
                timing: Date.now() - startTime
            });
        } catch (error) {
            logger.error('Failed to delete vectors', {
                indexName,
                count: ids.length,
                error: error instanceof Error ? error.message : String(error),
                timing: Date.now() - startTime
            });
            throw this.handleVectorError(error);
        }
    }

    /**
     * Handle vector store errors and convert to VectorStoreError type
     */
    private handleVectorError(error: unknown): VectorStoreError {
        if (error instanceof Error) {
            // Handle Upstash specific errors
            if (error.message.includes('connection')) {
                return {
                    type: VectorStoreErrorType.CONNECTION_ERROR,
                    message: `Vector store connection error: ${error.message}`,
                    retryable: true,
                    originalError: error
                };
            }
            if (error.message.includes('validation')) {
                return {
                    type: VectorStoreErrorType.VALIDATION_ERROR,
                    message: `Vector store validation error: ${error.message}`,
                    retryable: false,
                    originalError: error
                };
            }
            if (error.message.includes('index')) {
                return {
                    type: VectorStoreErrorType.INDEX_ERROR,
                    message: `Vector store index error: ${error.message}`,
                    retryable: false,
                    originalError: error
                };
            }
            return {
                type: VectorStoreErrorType.OPERATION_ERROR,
                message: error.message,
                retryable: false,
                originalError: error
            };
        }
        return {
            type: VectorStoreErrorType.OPERATION_ERROR,
            message: 'Unknown vector store error',
            retryable: false,
            originalError: error
        };
    }
}

// Export only the singleton instance
export const vectorService = VectorService.getInstance();
