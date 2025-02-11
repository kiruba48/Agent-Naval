import { Index } from "@upstash/vector";

/**
 * Vector store configuration and types
 */

export enum VectorStoreErrorType {
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    OPERATION_ERROR = 'OPERATION_ERROR',
    INDEX_ERROR = 'INDEX_ERROR',
    BATCH_ERROR = 'BATCH_ERROR'
}

export interface VectorStoreError {
    type: VectorStoreErrorType;
    message: string;
    retryable: boolean;
    originalError?: unknown;
}

export interface VectorRetryConfig {
    maxAttempts: number;
    backoffMs: number;
}

export interface VectorMetadata {
    userId?: string;
    sessionId?: string;
    timestamp?: string;
    [key: string]: unknown;
}

export interface VectorEntry {
    id: string | number;
    vector: number[];
    metadata?: VectorMetadata;
}

export interface VectorIndexConfig {
    name: string;
    url: string;
    token: string;
    dimensions: number;
}

export interface QueryOptions {
    topK?: number;
    threshold?: number;
    filter?: {
        userId?: string;
        sessionId?: string;
        timeRange?: {
            start: Date;
            end: Date;
        }
    }
}

export interface SimilaritySearchResult {
    id: string | number;
    score: number;
    vector: number[];
    metadata?: VectorMetadata;
}

export interface BatchOperationResult {
    success: boolean;
    errors?: {
        index: number;
        error: VectorStoreError;
    }[];
    stats?: BatchOperationStats;
}

export interface BatchOperationStats {
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
}

// Batch operation types
export interface BatchChunk<T> {
    items: T[];
    startIndex: number;
}

export interface BatchResult {
    success: boolean;
    failedIndices?: number[];
    error?: VectorStoreError;
    stats?: {
        processedItems: number;
        successfulItems: number;
        failedItems: number;
    };
}

// Upstash specific types for internal use
export interface UpstashQueryOptions {
    vector: number[];
    topK: number;
    includeMetadata: boolean;
    includeVectors: boolean;
    filter?: string;
}

export interface UpstashQueryResult {
    id: string;
    score: number;
    vector?: number[];
    metadata?: VectorMetadata;
}
