import { OpenAI } from "openai";
import { ChromaClient } from "chromadb";
import 'dotenv/config'; 
import { processFile, ProcessedChunk } from "./processFile";
import * as fs from 'fs';
import * as path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ChromaDB connection with retry logic
async function getChromaClient(retries = 3, delay = 1000): Promise<ChromaClient> {
    for (let i = 0; i < retries; i++) {
        try {
            const client = new ChromaClient();
            // Test the connection
            await client.heartbeat();
            return client;
        } catch (error) {
            console.log(`ChromaDB connection attempt ${i + 1} failed. ${i < retries - 1 ? 'Retrying...' : ''}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error('Failed to connect to ChromaDB. Make sure the server is running.');
            }
        }
    }
    throw new Error('Failed to connect to ChromaDB after retries');
}

// Get ChromaDB client when needed instead of global instance
async function getChroma() {
    return await getChromaClient();
}

// Directory for storing embeddings
const EMBEDDINGS_DIR = path.join(process.cwd(), 'embeddings');
if (!fs.existsSync(EMBEDDINGS_DIR)) {
    fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

interface EmbeddingDocument {
    id: string;
    content: string;
    sourceFile: string;
    embedding: number[];
}

/**
 * Generate OpenAI embeddings for a list of text chunks.
 */
async function generateEmbeddings(chunks: ProcessedChunk[]): Promise<number[][]> {
    const batchSize = 100;
    const embeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        try {
            console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: batch.map(chunk => chunk.content.trim()).filter(text => text.length > 0),
            });
            embeddings.push(...response.data.map(r => r.embedding));
        } catch (error: any) {
            console.error(`Error generating embeddings for batch ${i / batchSize + 1}:`, error.message);
            throw new Error(`Failed to generate embeddings: ${error.message}`);
        }
    }

    return embeddings;
}

/**
 * Stores processed chunks and their embeddings in ChromaDB and locally.
 */
export async function createVectorStore(
    filePaths: string | string[],
    collectionName: string
) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    
    // Process all files in parallel
    const chunks = await processFile(paths);
    console.log(`Processing ${chunks.length} total chunks from ${paths.length} files...`);

    const embeddings = await generateEmbeddings(chunks);
    console.log("Generated embeddings");

    // Create documents with source file tracking
    const documents: EmbeddingDocument[] = chunks.map((chunk, i) => ({
        id: `chunk_${i}`,
        content: chunk.content,
        sourceFile: chunk.sourceFile,
        embedding: embeddings[i],
    }));

    // Save embeddings locally with metadata for all files
    const embeddingsFile = path.join(EMBEDDINGS_DIR, `${collectionName}.json`);
    fs.writeFileSync(embeddingsFile, JSON.stringify({
        metadata: {
            sourceFiles: paths,
            timestamp: new Date().toISOString(),
            chunkCount: chunks.length,
            filesCount: paths.length
        },
        documents: documents
    }, null, 2));
    console.log(`Saved embeddings to ${embeddingsFile}`);

    // Store in ChromaDB with source file metadata
    const chroma = await getChroma();
    const collection = await chroma.getOrCreateCollection({ name: collectionName });
    await collection.add({
        ids: documents.map((doc) => doc.id),
        embeddings: documents.map((doc) => doc.embedding),
        metadatas: documents.map((doc) => ({ 
            text: doc.content,
            sourceFile: doc.sourceFile
        })),
    });

    console.log(`Stored ${documents.length} chunks from ${paths.length} files in ChromaDB and locally.`);
    return documents;
}
