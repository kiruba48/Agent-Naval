import { Index } from "@upstash/vector";
import 'dotenv/config'; 
import { processFile, ProcessedChunk } from "./processFile";
import * as fs from 'fs';
import * as path from 'path';
import { batchClassifyThemes } from './themeClassifier';
import { generateEmbeddings as generateOpenAIEmbeddings } from './llm';

const UPSTASH_VECTOR_REST_URL = process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_VECTOR_REST_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

if (!UPSTASH_VECTOR_REST_URL) throw new Error("Missing Upstash Vector REST URL!");
if (!UPSTASH_VECTOR_REST_TOKEN) throw new Error("Missing Upstash Vector REST Token!");

// Initialize Upstash Vector client
const vectorIndex = new Index({
    url: UPSTASH_VECTOR_REST_URL,
    token: UPSTASH_VECTOR_REST_TOKEN
});

// Directory for storing embeddings
const EMBEDDINGS_DIR = path.join(process.cwd(), 'embeddings');
if (!fs.existsSync(EMBEDDINGS_DIR)) {
    fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

interface EmbeddingDocument {
    id: string;
    content: string;
    sourceFile: string;
    metadata: {
        title?: string;
        author?: string;
        chapter?: string;
        themes: string[];
    };
    embedding: number[];
}

/**
 * Generates embeddings for text chunks using OpenAI's API
 */
async function generateEmbeddings(chunks: ProcessedChunk[]): Promise<EmbeddingDocument[]> {
    console.log('Classifying themes for chunks...');
    const themeResults = await batchClassifyThemes(chunks.map(chunk => chunk.content));
    
    console.log('Generating embeddings...');
    const embeddingResponse = await generateOpenAIEmbeddings(chunks.map(chunk => chunk.content));

    return chunks.map((chunk, i) => ({
        id: `${chunk.sourceFile}-${i}`,
        content: chunk.content,
        sourceFile: chunk.sourceFile,
        metadata: {
            ...chunk.metadata,
            themes: themeResults[i].themes
        },
        embedding: embeddingResponse[i],
    }));
}

// Create a reusable embedding function
export const embeddingFunction = {
    async generate(texts: string[]): Promise<number[][]> {
        const response = await generateOpenAIEmbeddings(texts);
        return response;
    }
};

/**
 * Utility function to reset the vector store (use only when needed)
 */
export async function resetVectorStore() {
    console.log('Resetting vector store...');
    try {
        await vectorIndex.reset();
        console.log('Vector store reset successfully');
    } catch (error) {
        console.error('Error resetting vector store:', error);
        throw error;
    }
}

/**
 * Creates or updates a vector store with processed chunks
 */
export async function createVectorStore(filePaths: string | string[], collectionName: string) {
    // Process files and get chunks
    const chunks = await processFile(filePaths);
    console.log(`Generated ${chunks.length} chunks from ${Array.isArray(filePaths) ? filePaths.length : 1} file(s)`);

    // Generate embeddings and classify themes
    const documents = await generateEmbeddings(chunks);
    
    // Save embeddings locally
    const embeddingsPath = path.join(EMBEDDINGS_DIR, `${collectionName}.json`);
    fs.writeFileSync(embeddingsPath, JSON.stringify(documents, null, 2));

    // Create vector store entries
    const entries = documents.map(doc => {
        const entry = {
            id: doc.id,
            vector: doc.embedding,
            metadata: {
                content: doc.content,
                sourceFile: doc.sourceFile,
                themes: doc.metadata.themes.join(','), // Convert array to comma-separated string
                ...(doc.metadata.title && { title: doc.metadata.title }),
                ...(doc.metadata.author && { author: doc.metadata.author }),
                ...(doc.metadata.chapter && { chapter: doc.metadata.chapter })
            }
        };
        console.log('Creating vector store entry:', JSON.stringify(entry, null, 2));
        return entry;
    });

    // Add to Upstash Vector
    console.log(`Starting upload of ${documents.length} vectors to Upstash...`);
    const batchSize = 50;
    const batches = Math.ceil(documents.length / batchSize);
    const startTime = Date.now();

    for (let i = 0; i < documents.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        console.log(`Processing batch ${batchNumber}/${batches} (${batch.length} documents)...`);
        
        try {
            await Promise.all(batch.map(doc => 
                vectorIndex.upsert(doc)
            ));
            console.log(`✓ Batch ${batchNumber}/${batches} uploaded successfully`);
        } catch (error) {
            console.error(`Error uploading batch ${batchNumber}/${batches}:`, error);
            throw error;
        }
    }

    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Successfully created vector store with ${documents.length} documents in ${timeElapsed}s`);
    return documents;
}

/**
 * Queries the vector store for relevant chunks
 */
export async function queryVectorStore(query: string, collectionName: string, themes?: string[]) {
    // Generate query embedding
    const [queryEmbedding] = await embeddingFunction.generate([query]);

    // Query Upstash Vector
    const results = await vectorIndex.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true, // Request metadata to be included in results
        ...(themes && themes.length > 0 && {
            filter: `themes:${themes[0]}` // Convert to string format that Upstash expects
        })
    });

    console.log('Raw results from Upstash:', JSON.stringify(results, null, 2));

    return results.map(result => {
        if (!result.metadata || typeof result.metadata !== 'object') {
            console.error('Invalid metadata for result:', JSON.stringify(result, null, 2));
            throw new Error(`Invalid metadata in result: ${result.id}`);
        }
        
        const metadata = result.metadata as {
            content: string;
            sourceFile: string;
            themes: string;
            title?: string;
            author?: string;
            chapter?: string;
        };

        // Validate required metadata fields
        if (!metadata.content || !metadata.sourceFile || !metadata.themes) {
            console.error('Missing required metadata fields:', metadata);
            throw new Error(`Missing required metadata fields in result: ${result.id}`);
        }

        return {
            id: result.id,
            score: result.score,
            metadata: {
                content: metadata.content,
                sourceFile: metadata.sourceFile,
                themes: metadata.themes.split(',').map(t => t.trim()),
                ...(metadata.title && { title: metadata.title }),
                ...(metadata.author && { author: metadata.author }),
                ...(metadata.chapter && { chapter: metadata.chapter })
            }
        };
    });
}
