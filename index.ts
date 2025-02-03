import * as readlineSync from "readline-sync";
import { createVectorStore } from "./src/vectorStore";
import { answerQuery } from "./src/queryEngine";
import 'dotenv/config'

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
const FILE_PATH = "./data/Naval_Incerto.epub";

// Initial PDF processing (only run once)
async function setup() {
    console.log("📥 Processing PDF and creating vector store...");
    await createVectorStore(FILE_PATH, COLLECTION_NAME);
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

            const answer = await answerQuery(query, COLLECTION_NAME);
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
