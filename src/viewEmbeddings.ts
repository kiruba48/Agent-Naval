import { ChromaClient } from "chromadb";

async function viewEmbeddings(collectionName: string) {
    const chroma = new ChromaClient();
    
    try {
        const collection = await chroma.getCollection({ name: collectionName });
        const result = await collection.get();
        
        console.log(`\nCollection: ${collectionName}`);
        console.log(`Total embeddings: ${result.ids.length}`);
        
        // Display first few chunks with their IDs
        console.log("\nSample chunks:");
        for (let i = 0; i < Math.min(3, result.ids.length); i++) {
            console.log(`\nChunk ${result.ids[i]}:`);
            console.log(`Text: ${result.metadatas[i].text.substring(0, 200)}...`);
            console.log(`Embedding dimensions: ${result.embeddings[i].length}`);
        }
    } catch (error) {
        console.error("Error viewing embeddings:", error);
    }
}

// View embeddings for the Naval collection
viewEmbeddings("naval_collection");
