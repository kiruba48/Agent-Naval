import { OpenAI } from "openai";
import { ChromaClient } from "chromadb";
import 'dotenv/config'; 
import { processFile } from "./processFile";
import * as fs from 'fs';
import * as path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const chroma = new ChromaClient(); // Connects to local ChromaDB instance

// Directory for storing embeddings
const EMBEDDINGS_DIR = path.join(process.cwd(), 'embeddings');
if (!fs.existsSync(EMBEDDINGS_DIR)) {
    fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

interface EmbeddingDocument {
    id: string;
    content: string;
    embedding: number[];
}

/**
 * Generate OpenAI embeddings for a list of text chunks.
 * Processes chunks in batches to avoid API limits.
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 100; // Process 100 chunks at a time
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        try {
            console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(texts.length / batchSize)}`);
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: batch.map(text => text.trim()).filter(text => text.length > 0),
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
export async function createVectorStore(filePath: string, collectionName: string) {
    const chunks = await processFile(filePath);
    console.log(`Processing ${chunks.length} chunks...`);

    const embeddings = await generateEmbeddings(chunks);
    console.log("Generated embeddings");

    // Create documents with IDs and embeddings
    const documents: EmbeddingDocument[] = chunks.map((chunk, i) => ({
        id: `chunk_${i}`,
        content: chunk,
        embedding: embeddings[i],
    }));

    // Save embeddings locally
    const embeddingsFile = path.join(EMBEDDINGS_DIR, `${collectionName}.json`);
    fs.writeFileSync(embeddingsFile, JSON.stringify({
        metadata: {
            sourceFile: filePath,
            timestamp: new Date().toISOString(),
            chunkCount: chunks.length,
        },
        documents: documents
    }, null, 2));
    console.log(`Saved embeddings to ${embeddingsFile}`);

    // Store in ChromaDB
    const collection = await chroma.getOrCreateCollection({ name: collectionName });
    await collection.add({
        ids: documents.map((doc) => doc.id),
        embeddings: documents.map((doc) => doc.embedding),
        metadatas: documents.map((doc) => ({ text: doc.content })),
    });

    console.log(`Stored ${documents.length} chunks in ChromaDB and locally.`);
    return documents;
}
