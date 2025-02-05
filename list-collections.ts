import { ChromaClient } from "chromadb";

async function listCollections() {
    const client = new ChromaClient({
        path: process.env.CHROMA_API_URL || 'http://localhost:8000'
    });
    
    try {
        const collections = await client.listCollections();
        console.log('Collections:', JSON.stringify(collections, null, 2));
    } catch (error) {
        console.error('Error listing collections:', error);
    }
}

listCollections();
