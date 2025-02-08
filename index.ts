import * as readlineSync from "readline-sync";
import { createVectorStore } from "./src/vectorStore";
import { answerQuery } from "./src/queryEngine";
import 'dotenv/config'
import * as fs from 'fs';
import * as path from 'path';

// Add global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const COLLECTION_NAME = "naval_collection";
const DATA_DIR = "./data";

// Get all PDF and EPUB files from the data directory
function getDataFiles(): string[] {
    return fs.readdirSync(DATA_DIR)
        .filter(file => file.endsWith('.pdf') || file.endsWith('.epub'))
        .map(file => path.join(DATA_DIR, file));
}

// Initial file processing (only run once)
async function setup() {
    const files = getDataFiles();
    console.log(`📥 Processing ${files.length} files and creating vector store...`);
    await createVectorStore(files, COLLECTION_NAME);
}

// Interactive loop for user queries
async function main() {
    try {
        if (!process.argv.includes("--skip-setup")) {
            await setup();
        }
        console.log("💬 Naval RAG Chatbot Ready! Ask a question or type 'exit' to quit.");

        while (true) {
            const query = readlineSync.question("\n🔹 Your Question: ");
            if (query.toLowerCase() === "exit") break;

            const answer = await answerQuery(query, COLLECTION_NAME, true);
            console.log("\n💡 AI Response:", answer);
        }
    } catch (error) {
        console.error("Error in main:", error);
        process.exit(1);
    }
}

// Run Setup & Start Chat
(async () => {
    await main();
})();
