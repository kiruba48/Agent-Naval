import { Index } from "@upstash/vector";
import { 
    VectorStoreError, 
    VectorStoreErrorType,
    VectorIndexConfig,
    VectorEntry,
    QueryOptions,
    SimilaritySearchResult,
    UpstashQueryOptions,
    VectorMetadata,
    BatchOperationResult,
    BatchResult,
    BatchChunk,
    BatchOperationStats
} from '../types/vector';
import {
    VECTOR_INDICES,
    DEFAULT_RETRY_CONFIG,
    DEFAULT_QUERY_OPTIONS,
    BATCH_CONFIG
} from '../constants/vector';

/**
 * Service for managing vector operations for conversation memory
 */
class VectorService {
    private static instance: VectorService;
    private indices: Map<string, Index<VectorMetadata>> = new Map();
    private indexConfigs: Map<Index<VectorMetadata>, string> = new Map();
    private initialized = false;

    private constructor() {}

    public static getInstance(): VectorService {
        if (!VectorService.instance) {
            VectorService.instance = new VectorService();
        }
        return VectorService.instance;
    }

    /**
     * Initialize vector indices
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Initialize each configured index
            for (const [name, config] of Object.entries(VECTOR_INDICES)) {
                const index = new Index({
                    url: config.url,
                    token: config.token
                });

                this.indices.set(name, index);
                this.indexConfigs.set(index, name);
            }

            this.initialized = true;
            console.log('Vector service initialized successfully');
        } catch (error) {
            throw this.handleError(error, {
                type: VectorStoreErrorType.CONNECTION_ERROR,
                message: 'Failed to initialize vector service'
            });
        }
    }

    /**
     * Store a single vector in the specified index
     */
    public async upsertVector(indexName: string, entry: VectorEntry): Promise<void> {
        try {
            // Validate vector dimensions
            this.validateVector(indexName, entry.vector);
            
            // Get index instance
            const index = this.getIndex(indexName);
            
            // Attempt upsert with retry
            await this.withRetry(
                async () => {
                    await index.upsert([{
                        id: this.convertToStringId(entry.id),
                        vector: entry.vector,
                        metadata: entry.metadata as VectorMetadata
                    }]);
                },
                {
                    type: VectorStoreErrorType.OPERATION_ERROR,
                    message: `Failed to upsert vector ${entry.id} in index ${indexName}`
                }
            );
            
            console.log(`Successfully upserted vector ${entry.id} in index ${indexName}`);
        } catch (error) {
            throw this.handleError(error, {
                type: VectorStoreErrorType.OPERATION_ERROR,
                message: `Failed to upsert vector ${entry.id} in index ${indexName}`
            });
        }
    }

    /**
     * Delete a single vector from the specified index
     */
    public async deleteVector(indexName: string, id: string): Promise<void> {
        try {
            const index = this.getIndex(indexName);
            
            await this.withRetry(
                async () => {
                    await index.delete([this.convertToStringId(id)]);
                },
                {
                    type: VectorStoreErrorType.OPERATION_ERROR,
                    message: `Failed to delete vector ${id} from index ${indexName}`
                }
            );
            
            console.log(`Successfully deleted vector ${id} from index ${indexName}`);
        } catch (error) {
            throw this.handleError(error, {
                type: VectorStoreErrorType.OPERATION_ERROR,
                message: `Failed to delete vector ${id} from index ${indexName}`
            });
        }
    }

    /**
     * Prepare query options for Upstash Vector
     */
    private prepareQueryOptions(
        vector: number[],
        options: QueryOptions
    ): UpstashQueryOptions {
        return {
            vector,
            topK: options.topK ?? DEFAULT_QUERY_OPTIONS.topK!,
            includeMetadata: true,
            includeVectors: true,
            ...(options.filter && this.buildFilterString(options.filter))
        };
    }

    /**
     * Execute raw vector query with retry logic
     */
    private async executeQuery(
        index: Index<VectorMetadata>,
        queryOptions: UpstashQueryOptions,
        indexName: string
    ): Promise<SimilaritySearchResult[]> {
        return this.withRetry(
            async () => {
                const response = await index.query(queryOptions);
                return response.map(result => ({
                    id: result.id,
                    score: result.score,
                    vector: result.vector || [],
                    metadata: result.metadata
                }));
            },
            {
                type: VectorStoreErrorType.OPERATION_ERROR,
                message: `Failed to query vectors in index ${indexName}`
            }
        );
    }

    /**
     * Filter and transform query results
     */
    private processQueryResults(
        results: SimilaritySearchResult[],
        threshold: number
    ): SimilaritySearchResult[] {
        // Filter by threshold
        const filteredResults = results.filter(result => result.score >= threshold);
        
        // Transform to proper type
        return filteredResults.map(result => ({
            id: result.id,
            score: result.score,
            vector: Array.isArray(result.vector) ? result.vector : [],
            metadata: result.metadata || {}
        }));
    }

    /**
     * Query vectors by similarity
     */
    public async queryVectors(
        indexName: string,
        vector: number[],
        options: QueryOptions = {}
    ): Promise<SimilaritySearchResult[]> {
        try {
            // Validate vector dimensions
            this.validateVector(indexName, vector);
            
            // Get index instance
            const index = this.getIndex(indexName);
            
            // Prepare query options
            const queryOptions = this.prepareQueryOptions(vector, options);
            
            // Execute query
            const results = await this.executeQuery(index, queryOptions, indexName);
            
            // Process results
            const threshold = options.threshold ?? DEFAULT_QUERY_OPTIONS.threshold!;
            const processedResults = this.processQueryResults(results, threshold);
            
            console.log(`Query returned ${processedResults.length} results from index ${indexName}`);
            
            return processedResults;
        } catch (error) {
            throw this.handleError(error, {
                type: VectorStoreErrorType.OPERATION_ERROR,
                message: `Failed to query vectors in index ${indexName}`
            });
        }
    }

    /**
     * Get index instance by name
     */
    private getIndex(indexName: string): Index<VectorMetadata> {
        const index = this.indices.get(indexName);
        if (!index) {
            throw new Error(`Invalid index name: ${indexName}`);
        }
        return index;
    }

    /**
     * Get index name from instance
     */
    private getIndexName(index: Index<VectorMetadata>): string {
        const name = this.indexConfigs.get(index);
        if (!name) {
            throw new Error('Unknown index instance');
        }
        return name;
    }

    /**
     * Get the expected dimensions for an index
     */
    private getIndexDimensions(indexName: string): number {
        const config = VECTOR_INDICES[indexName as keyof typeof VECTOR_INDICES];
        if (!config) {
            throw new Error(`Invalid index name: ${indexName}`);
        }
        return config.dimensions;
    }

    /**
     * Validate vector dimensions
     */
    private validateVector(indexName: string, vector: number[]): void {
        const expectedDimensions = this.getIndexDimensions(indexName);
        
        if (!Array.isArray(vector)) {
            throw new Error('Vector must be an array');
        }
        
        if (vector.length !== expectedDimensions) {
            throw new Error(
                `Vector dimensions mismatch. Expected ${expectedDimensions}, got ${vector.length}`
            );
        }
    }

    /**
     * Build filter string for Upstash query
     */
    private buildFilterString(filter: QueryOptions['filter']): { filter: string } | undefined {
        if (!filter) return undefined;

        const conditions: string[] = [];

        if (filter.userId) {
            conditions.push(`userId:${filter.userId}`);
        }
        if (filter.sessionId) {
            conditions.push(`sessionId:${filter.sessionId}`);
        }
        if (filter.timeRange) {
            conditions.push(
                `timestamp:>=${filter.timeRange.start.toISOString()}`,
                `timestamp:<=${filter.timeRange.end.toISOString()}`
            );
        }

        return conditions.length > 0 ? { filter: conditions.join(' AND ') } : undefined;
    }

    /**
     * Handle operation with retry logic
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        errorConfig: Omit<VectorStoreError, 'retryable'>
    ): Promise<T> {
        let lastError: unknown;
        
        for (let attempt = 1; attempt <= DEFAULT_RETRY_CONFIG.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't retry validation errors
                if (errorConfig.type === VectorStoreErrorType.VALIDATION_ERROR) {
                    throw this.handleError(error, errorConfig);
                }

                // Last attempt, throw error
                if (attempt === DEFAULT_RETRY_CONFIG.maxAttempts) {
                    break;
                }

                // Wait with exponential backoff before retrying
                const delayMs = DEFAULT_RETRY_CONFIG.backoffMs * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
                console.warn(
                    `Retry attempt ${attempt}/${DEFAULT_RETRY_CONFIG.maxAttempts} for operation:`,
                    errorConfig.message
                );
            }
        }

        throw this.handleError(lastError, errorConfig);
    }

    /**
     * Format error with additional context
     */
    private handleError(
        error: unknown, 
        config: Omit<VectorStoreError, 'retryable'>
    ): VectorStoreError {
        const isRetryable = 
            config.type === VectorStoreErrorType.CONNECTION_ERROR ||
            config.type === VectorStoreErrorType.OPERATION_ERROR ||
            (error as Error)?.message?.includes('timeout');

        return {
            ...config,
            retryable: isRetryable,
            originalError: error
        };
    }

    /**
     * Split array into chunks for batch processing
     */
    private createBatchChunks<T>(items: T[]): BatchChunk<T>[] {
        const chunks: BatchChunk<T>[] = [];
        for (let i = 0; i < items.length; i += BATCH_CONFIG.CHUNK_SIZE) {
            chunks.push({
                items: items.slice(i, i + BATCH_CONFIG.CHUNK_SIZE),
                startIndex: i
            });
        }
        return chunks;
    }

    /**
     * Convert ID to string format required by Upstash
     */
    private convertToStringId(id: string | number): string {
        return id.toString();
    }

    /**
     * Process a single batch chunk
     */
    private async processBatchChunk(
        chunk: BatchChunk<VectorEntry>,
        index: Index<VectorMetadata>,
        operation: 'upsert' | 'delete'
    ): Promise<BatchResult> {
        try {
            const indexName = this.getIndexName(index);
            console.log(`Processing ${operation} chunk of ${chunk.items.length} items starting at index ${chunk.startIndex}`);

            // Validate all vectors in the chunk if upserting
            if (operation === 'upsert') {
                console.log('Validating vectors...');
                chunk.items.forEach(item => {
                    this.validateVector(indexName, item.vector);
                });
            }

            // Execute operation with retry
            const startTime = new Date();
            await this.withRetry(
                async () => {
                    if (operation === 'upsert') {
                        await index.upsert(chunk.items.map(item => ({
                            id: this.convertToStringId(item.id),
                            vector: item.vector,
                            metadata: item.metadata
                        })));
                    } else {
                        await index.delete(chunk.items.map(item => 
                            this.convertToStringId(item.id)
                        ));
                    }
                },
                {
                    type: VectorStoreErrorType.BATCH_ERROR,
                    message: `Failed to ${operation} batch chunk starting at index ${chunk.startIndex}`
                }
            );

            const endTime = new Date();
            const durationMs = endTime.getTime() - startTime.getTime();
            console.log(`Successfully processed chunk in ${durationMs}ms`);

            return {
                success: true,
                stats: {
                    processedItems: chunk.items.length,
                    successfulItems: chunk.items.length,
                    failedItems: 0
                }
            };
        } catch (error) {
            console.error(`Failed to process chunk starting at index ${chunk.startIndex}:`, error);
            return {
                success: false,
                failedIndices: Array.from(
                    { length: chunk.items.length },
                    (_, i) => chunk.startIndex + i
                ),
                error: this.handleError(error, {
                    type: VectorStoreErrorType.BATCH_ERROR,
                    message: `Failed to ${operation} batch chunk starting at index ${chunk.startIndex}`
                }),
                stats: {
                    processedItems: chunk.items.length,
                    successfulItems: 0,
                    failedItems: chunk.items.length
                }
            };
        }
    }

    /**
     * Process multiple chunks concurrently
     */
    private async processBatchChunks(
        chunks: BatchChunk<VectorEntry>[],
        index: Index<VectorMetadata>,
        operation: 'upsert' | 'delete'
    ): Promise<BatchOperationResult> {
        const stats: BatchOperationStats = {
            totalItems: chunks.reduce((total, chunk) => total + chunk.items.length, 0),
            processedItems: 0,
            successfulItems: 0,
            failedItems: 0,
            startTime: new Date()
        };

        const results: BatchResult[] = [];
        console.log(`Starting batch ${operation} of ${stats.totalItems} items in ${chunks.length} chunks`);
        
        // Process chunks with concurrency control
        for (let i = 0; i < chunks.length; i += BATCH_CONFIG.MAX_CONCURRENT_BATCHES) {
            const batch = chunks.slice(i, i + BATCH_CONFIG.MAX_CONCURRENT_BATCHES);
            console.log(`Processing batch ${i / BATCH_CONFIG.MAX_CONCURRENT_BATCHES + 1} of ${Math.ceil(chunks.length / BATCH_CONFIG.MAX_CONCURRENT_BATCHES)}`);
            
            const batchResults = await Promise.all(
                batch.map(chunk => this.processBatchChunk(chunk, index, operation))
            );
            
            results.push(...batchResults);

            // Update stats
            batchResults.forEach(result => {
                if (result.stats) {
                    stats.processedItems += result.stats.processedItems;
                    stats.successfulItems += result.stats.successfulItems;
                    stats.failedItems += result.stats.failedItems;
                }
            });

            // Log progress
            const progress = ((stats.processedItems / stats.totalItems) * 100).toFixed(2);
            console.log(`Progress: ${progress}% (${stats.processedItems}/${stats.totalItems} items)`);
            console.log(`Success rate: ${((stats.successfulItems / stats.processedItems) * 100).toFixed(2)}%`);
        }

        // Finalize stats
        stats.endTime = new Date();
        stats.durationMs = stats.endTime.getTime() - stats.startTime.getTime();

        // Aggregate errors
        const errors = results
            .filter(result => !result.success)
            .flatMap((result, chunkIndex) => 
                (result.failedIndices || []).map(index => ({
                    index,
                    error: result.error!
                }))
            );

        // Log final summary
        console.log(`
Batch operation completed:
- Total time: ${stats.durationMs}ms
- Total items: ${stats.totalItems}
- Successful: ${stats.successfulItems}
- Failed: ${stats.failedItems}
- Success rate: ${((stats.successfulItems / stats.totalItems) * 100).toFixed(2)}%
        `);

        return {
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            stats
        };
    }

    /**
     * Batch upsert vectors
     */
    public async upsertBatch(
        indexName: string,
        entries: VectorEntry[]
    ): Promise<BatchOperationResult> {
        try {
            console.log(`Starting batch upsert to index ${indexName}`);
            
            // Validate input
            if (entries.length === 0) {
                throw new Error('Empty batch');
            }
            if (entries.length > BATCH_CONFIG.MAX_BATCH_SIZE) {
                throw new Error(`Batch size exceeds maximum of ${BATCH_CONFIG.MAX_BATCH_SIZE}`);
            }

            const index = this.getIndex(indexName);
            const chunks = this.createBatchChunks(entries);
            
            return await this.processBatchChunks(chunks, index, 'upsert');
        } catch (error) {
            console.error('Batch upsert failed:', error);
            throw this.handleError(error, {
                type: VectorStoreErrorType.BATCH_ERROR,
                message: `Failed to process batch upsert for index ${indexName}`
            });
        }
    }

    /**
     * Batch delete vectors
     */
    public async deleteBatch(
        indexName: string,
        entries: VectorEntry[]
    ): Promise<BatchOperationResult> {
        try {
            console.log(`Starting batch delete from index ${indexName}`);
            
            // Validate input
            if (entries.length === 0) {
                throw new Error('Empty batch');
            }
            if (entries.length > BATCH_CONFIG.MAX_BATCH_SIZE) {
                throw new Error(`Batch size exceeds maximum of ${BATCH_CONFIG.MAX_BATCH_SIZE}`);
            }

            const index = this.getIndex(indexName);
            const startTime = new Date();
            
            // Delete all IDs in a single operation
            try {
                await this.withRetry(
                    async () => {
                        console.log(`Deleting ${entries.length} vectors...`);
                        await index.delete(entries.map(entry => 
                            this.convertToStringId(entry.id)
                        ));
                    },
                    {
                        type: VectorStoreErrorType.BATCH_ERROR,
                        message: `Failed to delete vectors from index ${indexName}`
                    }
                );
                
                const endTime = new Date();
                const stats: BatchOperationStats = {
                    totalItems: entries.length,
                    processedItems: entries.length,
                    successfulItems: entries.length,
                    failedItems: 0,
                    startTime,
                    endTime,
                    durationMs: endTime.getTime() - startTime.getTime()
                };

                console.log(`
Batch delete completed successfully:
- Total time: ${stats.durationMs}ms
- Items deleted: ${stats.successfulItems}
                `);
                
                return { success: true, stats };
            } catch (error) {
                console.error('Batch delete failed:', error);
                const stats: BatchOperationStats = {
                    totalItems: entries.length,
                    processedItems: entries.length,
                    successfulItems: 0,
                    failedItems: entries.length,
                    startTime,
                    endTime: new Date()
                };
                
                return {
                    success: false,
                    errors: entries.map((_, index) => ({
                        index,
                        error: this.handleError(error, {
                            type: VectorStoreErrorType.BATCH_ERROR,
                            message: `Failed to delete vectors from index ${indexName}`
                        })
                    })),
                    stats
                };
            }
        } catch (error) {
            console.error('Batch delete failed:', error);
            throw this.handleError(error, {
                type: VectorStoreErrorType.BATCH_ERROR,
                message: `Failed to process batch delete for index ${indexName}`
            });
        }
    }
}

// Export singleton instance
export const vectorService = VectorService.getInstance();
