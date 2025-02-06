import fs from "fs";
import EPUB from "epub";
import * as pdfjsLib from 'pdfjs-dist';
import { fileURLToPath } from 'url';
import path from 'path';
import { classifyThemes } from './themeClassifier';

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
    metadata: {
        title?: string;
        author?: string;
        chapter?: string;
        themes: string[];
        sourceReference: string;
    };
}

/**
 * Splits text into manageable chunks with source tracking.
 */
async function chunkText(text: string, sourceFile: string, baseMetadata: Omit<ProcessedChunk['metadata'], 'themes' | 'sourceReference'>, chunkSize = 1000, chunkOverlap = 200): Promise<ProcessedChunk[]> {
    const words = text.split(" ");
    const chunks: ProcessedChunk[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    let chunkNumber = 0;
    
    // Estimate total chunks
    const estimatedTotalChunks = Math.ceil(text.length / (chunkSize - chunkOverlap));
    console.log(`Processing ${sourceFile}: Estimated ${estimatedTotalChunks} chunks to process`);

    for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for space

        if (currentLength >= chunkSize) {
            chunkNumber++;
            console.log(`Processing chunk ${chunkNumber}/${estimatedTotalChunks} (${Math.round(chunkNumber/estimatedTotalChunks * 100)}%)`);
            
            const content = currentChunk.join(" ");
            const themeResult = await classifyThemes(content);
            // Compute source reference
            const sourceReference = `${baseMetadata.title || path.basename(sourceFile)}${baseMetadata.chapter ? `, Chapter ${baseMetadata.chapter}` : ''}, Paragraph ${chunkNumber}`;
            chunks.push({
                content,
                sourceFile,
                metadata: {
                    ...baseMetadata,
                    themes: themeResult.themes,
                    sourceReference
                }
            });
            // Keep last few words for overlap
            const overlapWords = currentChunk.slice(-Math.floor(chunkOverlap / 10));
            currentChunk = overlapWords;
            currentLength = overlapWords.join(" ").length;
        }
    }

    if (currentChunk.length > 0) {
        const content = currentChunk.join(" ");
        const themeResult = await classifyThemes(content);
        // Compute source reference for the final chunk
        const sourceReference = `${baseMetadata.title || path.basename(sourceFile)}${baseMetadata.chapter ? `, Chapter ${baseMetadata.chapter}` : ''}, Paragraph ${chunkNumber + 1}`;
        chunks.push({
            content,
            sourceFile,
            metadata: {
                ...baseMetadata,
                themes: themeResult.themes,
                sourceReference
            }
        });
    }

    return chunks;
}

/**
 * Processes an EPUB file and returns text chunks.
 */
export async function processEPUB(filePath: string): Promise<ProcessedChunk[]> {
    return new Promise((resolve, reject) => {
        const epub = new EPUB(filePath);
        
        epub.on('error', reject);
        
        epub.on('end', () => {
            const metadata = epub.metadata;
            console.log('Processing EPUB metadata:', metadata);
            
            // Get the spine items (chapters)
            const spineItems = epub.spine.contents;
            console.log(`Found ${spineItems.length} chapters`);
            
            // Process each chapter
            const chapterPromises = spineItems.map(item => {
                return new Promise<string>((resolve) => {
                    epub.getChapter(item.id, (error: Error | null, text: string | null) => {
                        if (error) {
                            console.warn(`Warning: Error reading chapter ${item.id}:`, error);
                            resolve('');
                            return;
                        }
                        
                        if (!text) {
                            console.warn(`Warning: No text in chapter ${item.id}`);
                            resolve('');
                            return;
                        }
                        
                        const cleanedText = cleanText(text);
                        if (cleanedText.length > 0) {
                            console.log(`Added chapter ${item.id} (${cleanedText.length} chars)`);
                        } else {
                            console.log(`Skipping empty chapter ${item.id}`);
                        }
                        resolve(cleanedText);
                    });
                });
            });

            Promise.all(chapterPromises).then(async chapterTexts => {
                const text = chapterTexts.join('\n\n');
                console.log('Generating text chunks...');
                const chunks = await chunkText(text, filePath, {
                    title: metadata.title,
                    author: metadata.creator,
                });
                
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

        epub.parse();
    });
}

/**
 * Processes a PDF file and returns text chunks.
 */
export async function processPDF(filePath: string): Promise<ProcessedChunk[]> {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    
    let fullText = '';
    
    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
    }
    
    return await chunkText(fullText, filePath, {});
}

/**
 * Processes a text file and returns text chunks.
 */
export async function processText(filePath: string): Promise<ProcessedChunk[]> {
    console.log(`[processText] Processing text file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const title = path.basename(filePath, path.extname(filePath));
    const baseMetadata = { title, author: '', chapter: '' };
    // Use chunkText to split the content into chunks
    return await chunkText(content, filePath, baseMetadata);
}

/**
 * Processes a file (EPUB, PDF, or text) and returns text chunks.
 */
export async function processFile(filePaths: string | string[]): Promise<ProcessedChunk[]> {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    
    // Process files in parallel
    const results = await Promise.all(paths.map(async (filePath) => {
        if (filePath.endsWith('.epub')) {
            return processEPUB(filePath);
        } else if (filePath.endsWith('.pdf')) {
            return processPDF(filePath);
        } else if (filePath.endsWith('.txt')) {
            return processText(filePath);
        }
        throw new Error('Unsupported file format');
    }));

    // Flatten all chunks
    return results.flat();
}
