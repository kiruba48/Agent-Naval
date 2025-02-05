import fs from "fs";
import EPUB from "epub";
import * as pdfjsLib from 'pdfjs-dist';
import { fileURLToPath } from 'url';
import path from 'path';

// Configure PDF.js worker
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

/**
 * Cleans text by removing special characters and normalizing whitespace.
 */
function cleanText(text: string): string {
    return text.replace(/[^a-zA-Z0-9.,!?'\s]/g, "").replace(/\s+/g, " ").trim();
}

export interface ProcessedChunk {
    content: string;
    sourceFile: string;
}

/**
 * Splits text into manageable chunks with source tracking.
 */
function chunkText(text: string, sourceFile: string, chunkSize = 500, chunkOverlap = 100): ProcessedChunk[] {
    const words = text.split(" ");
    const chunks: ProcessedChunk[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for space

        if (currentLength >= chunkSize) {
            chunks.push({
                content: currentChunk.join(" "),
                sourceFile
            });
            // Keep last few words for overlap
            const overlapWords = currentChunk.slice(-Math.floor(chunkOverlap / 10));
            currentChunk = overlapWords;
            currentLength = overlapWords.join(" ").length;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push({
            content: currentChunk.join(" "),
            sourceFile
        });
    }

    return chunks;
}

/**
 * Processes an EPUB file and returns text chunks.
 */
async function processEPUB(filePath: string): Promise<ProcessedChunk[]> {
    if (!filePath.endsWith(".epub")) {
        throw new Error("Unsupported file format. Only EPUB files are supported.");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    console.log(`📘 Processing EPUB: ${filePath}`);
    
    try {
        return new Promise<ProcessedChunk[]>((resolve, reject) => {
            const epub = new EPUB(filePath);
            
            epub.on('end', () => {
                let fullText = '';
                let chapterTexts: {title: string, text: string}[] = [];

                // Extract metadata
                const metadata = {
                    title: epub.metadata.title,
                    creator: epub.metadata.creator,
                    language: epub.metadata.language
                };

                console.log(`Processing book: ${metadata.title} by ${metadata.creator}`);

                // Get flow items for actual content
                if (!epub.flow || epub.flow.length === 0) {
                    reject(new Error("No chapters found in EPUB"));
                    return;
                }

                const flowItems = epub.flow;
                const flowLength = flowItems.length;
                console.log(`Found ${flowLength} chapters`);
                let processedChapters = 0;

                const chapterPromises = flowItems.map((item, index) => {
                    if (!item || !item.id) {
                        console.log(`Skipping invalid chapter at index ${index}`);
                        processedChapters++;
                        return Promise.resolve('');
                    }

                    console.log(`Processing chapter ${index + 1}/${flowLength}: ${item.id}`);

                    return new Promise<string>((resolve) => {
                        epub.getChapter(item.id, (error: Error | null, text: string) => {
                            if (error) {
                                console.error(`Error processing chapter ${item.id}:`, error);
                                resolve('');
                            } else {
                                const cleanedText = cleanText(text);
                                if (cleanedText.length > 0) {
                                    chapterTexts.push({
                                        title: item.id,
                                        text: cleanedText
                                    });
                                    console.log(`Added chapter ${item.id} (${cleanedText.length} chars)`);
                                } else {
                                    console.log(`Skipping empty chapter ${item.id}`);
                                }
                                resolve(cleanedText);
                            }
                        });
                    });
                });

                Promise.all(chapterPromises).then(chapterTexts => {
                    const text = chapterTexts.join('\n\n');
                    console.log('Generating text chunks...');
                    const chunks = chunkText(text, filePath);
                    
                    if (!chunks.length) {
                        throw new Error("Failed to generate text chunks");
                    }

                    console.log(`Generated ${chunks.length} text chunks`);
                    resolve(chunks);
                }).catch(error => {
                    console.error("Error processing EPUB:", error);
                    reject(error);
                });
            });

            epub.on('error', (err) => {
                console.error('Error parsing EPUB:', err);
                reject(err);
            });

            epub.parse();
        });
    } catch (error) {
        console.error("Error in processEPUB:", error);
        throw error;
    }
}

/**
 * Processes a PDF file and returns text chunks.
 */
async function processPDF(filePath: string): Promise<ProcessedChunk[]> {
    const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjsLib.getDocument(dataBuffer).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = cleanText(textContent.items
            .map(item => 'str' in item ? item.str : '')
            .join(' '));
        fullText += pageText + '\n';
    }
    
    return chunkText(fullText, filePath);
}

/**
 * Processes a file (EPUB or PDF) and returns text chunks.
 */
export async function processFile(filePaths: string | string[]): Promise<ProcessedChunk[]> {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    
    // Process files in parallel
    const results = await Promise.all(paths.map(async (filePath) => {
        if (filePath.endsWith('.epub')) {
            return processEPUB(filePath);
        } else if (filePath.endsWith('.pdf')) {
            return processPDF(filePath);
        }
        throw new Error('Unsupported file format');
    }));

    // Flatten all chunks
    return results.flat();
}
