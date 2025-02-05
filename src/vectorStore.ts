import { OpenAI } from "openai";
import { ChromaClient } from "chromadb";
import 'dotenv/config'; 
import { processFile, ProcessedChunk } from "./processFile";
import * as fs from 'fs';
import * as path from 'path';
import { batchClassifyThemes } from './themeClassifier';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ChromaDB connection with retry logic
async function getChromaClient(retries = 3, delay = 1000): Promise<ChromaClient> {
    for (let i = 0; i < retries; i++) {
        try {
            const client = new ChromaClient({
                path: process.env.CHROMA_API_URL || 'http://localhost:8000'
              });
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
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks.map(chunk => chunk.content),
    });

    return chunks.map((chunk, i) => ({
        id: `${chunk.sourceFile}-${i}`,
        content: chunk.content,
        sourceFile: chunk.sourceFile,
        metadata: {
            ...chunk.metadata,
            themes: themeResults[i].themes
        },
        embedding: embeddingResponse.data[i].embedding,
    }));
}

// Create a reusable embedding function
export const embeddingFunction = {
    async generate(texts: string[]): Promise<number[][]> {
        const openai = new OpenAI();
        const response = await openai.embeddings.create({
            input: texts,
            model: "text-embedding-3-small"
        });
        return response.data.map(item => item.embedding);
    }
};

/**
 * Creates or updates a vector store with processed chunks
 */
export async function createVectorStore(filePaths: string | string[], collectionName: string) {
    const client = await getChroma();
    const collection = await client.getOrCreateCollection({ 
        name: collectionName,
        embeddingFunction
    });

    // Process files and get chunks
    const chunks = await processFile(filePaths);
    console.log(`Generated ${chunks.length} chunks from ${Array.isArray(filePaths) ? filePaths.length : 1} file(s)`);

    // Generate embeddings and classify themes
    const documents = await generateEmbeddings(chunks);
    
    // Save embeddings locally
    const embeddingsPath = path.join(EMBEDDINGS_DIR, `${collectionName}.json`);
    fs.writeFileSync(embeddingsPath, JSON.stringify(documents, null, 2));

    // Add to ChromaDB
    await collection.add({
        ids: documents.map(doc => doc.id),
        embeddings: documents.map(doc => doc.embedding),
        metadatas: documents.map(doc => {
            const metadata: Record<string, string | number | boolean> = {
                sourceFile: doc.sourceFile,
                themes: doc.metadata.themes.join(',')
            };
            
            if (doc.metadata.title) metadata.title = doc.metadata.title;
            if (doc.metadata.author) metadata.author = doc.metadata.author;
            if (doc.metadata.chapter) metadata.chapter = doc.metadata.chapter;
            
            return metadata;
        }),
        documents: documents.map(doc => doc.content),
    });

    console.log(`Successfully created vector store with ${documents.length} documents`);
    return documents;
}

/**
 * Queries the vector store for relevant chunks
 */
export async function queryVectorStore(query: string, collectionName: string, themes?: string[]) {
    const client = await getChroma();
    const collection = await client.getCollection({ 
        name: collectionName,
        embeddingFunction
    });

    // Generate query embedding
    const queryEmbedding = await embeddingFunction.generate([query]);

    // Build where clause for theme filtering
    const where = themes && themes.length > 0
        ? { themes: { $in: themes } }
        : undefined;

    // Query ChromaDB
    const results = await collection.query({
        queryEmbeddings: queryEmbedding,
        where,
        nResults: 5,
    });

    return results;
}
