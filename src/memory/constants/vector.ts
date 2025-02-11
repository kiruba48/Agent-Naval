import { VectorIndexConfig, VectorRetryConfig, QueryOptions } from '../types/vector';

// Vector store indices configuration
export const VECTOR_INDICES: { [key: string]: VectorIndexConfig } = {
    KNOWLEDGE: {
        name: 'knowledge',
        url: process.env.UPSTASH_KNOWLEDGE_URL!,
        token: process.env.UPSTASH_KNOWLEDGE_TOKEN!,
        dimensions: 1024 // text-embedding-3-small dimensions
    },
    CONVERSATIONS: {
        name: 'conversations',
        url: process.env.UPSTASH_CONVERSATIONS_URL!,
        token: process.env.UPSTASH_CONVERSATIONS_TOKEN!,
        dimensions: 1024
    }
};

// Retry configuration for vector operations
export const DEFAULT_RETRY_CONFIG: VectorRetryConfig = {
    maxAttempts: 3,
    backoffMs: 1000 // Start with 1s, then 2s, then 4s
};

// Default query options
export const DEFAULT_QUERY_OPTIONS: Pick<Required<QueryOptions>, 'topK' | 'threshold'> & Partial<QueryOptions> = {
    topK: 5,
    threshold: 0.7
};

// Batch operation configuration
export const BATCH_CONFIG = {
    MAX_BATCH_SIZE: 100,
    MAX_CONCURRENT_BATCHES: 3,
    CHUNK_SIZE: 20
} as const;
