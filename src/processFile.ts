import fs from "fs";
import EPUB from "epub";

/**
 * Cleans text by removing special characters and normalizing whitespace.
 */
function cleanText(text: string): string {
    return text.replace(/[^a-zA-Z0-9.,!?'\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Splits text into manageable chunks.
 */
function chunkText(text: string, chunkSize = 500, chunkOverlap = 100): string[] {
    const words = text.split(" ");
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for space

        if (currentLength >= chunkSize) {
            chunks.push(currentChunk.join(" "));
            // Keep last few words for overlap
            const overlapWords = currentChunk.slice(-Math.floor(chunkOverlap / 10));
            currentChunk = overlapWords;
            currentLength = overlapWords.join(" ").length;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }

    return chunks;
}

/**
 * Processes an EPUB file and returns text chunks.
 */
export async function processFile(filePath: string): Promise<string[]> {
    if (!filePath.endsWith(".epub")) {
        throw new Error("Unsupported file format. Only EPUB files are supported.");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    console.log(`📘 Processing EPUB: ${filePath}`);
    
    try {
        const result = await new Promise<{ text: string; metadata: { title: string; creator: string; language: string; chapters: { title: string; text: string; }[]; }; }>((resolve, reject) => {
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

                flowItems.forEach((item, index) => {
                    if (!item || !item.id) {
                        console.log(`Skipping invalid chapter at index ${index}`);
                        processedChapters++;
                        return;
                    }

                    console.log(`Processing chapter ${index + 1}/${flowLength}: ${item.id}`);
                    
                    epub.getChapter(item.id, (err, text) => {
                        if (err) {
                            console.error(`Error extracting chapter ${item.id}:`, err);
                        } else {
                            // Clean chapter text
                            const cleanedText = text
                                .replace(/<[^>]*>/g, '')  // Remove HTML tags
                                .replace(/\s+/g, ' ')     // Normalize whitespace
                                .trim();
                            
                            if (cleanedText) {
                                fullText += cleanedText + '\n\n';
                                
                                chapterTexts.push({
                                    title: item.id,
                                    text: cleanedText
                                });
                                console.log(`Added chapter ${item.id} (${cleanedText.length} chars)`);
                            } else {
                                console.log(`Skipping empty chapter ${item.id}`);
                            }
                        }

                        processedChapters++;
                        console.log(`Progress: ${processedChapters}/${flowLength} chapters`);
                        
                        // Resolve when all chapters are processed
                        if (processedChapters === flowLength) {
                            console.log('All chapters processed, generating final text...');
                            resolve({
                                text: fullText,
                                metadata: {
                                    ...metadata,
                                    chapters: chapterTexts
                                }
                            });
                        }
                    });
                });
            });

            epub.on('error', (err) => {
                console.error('Error parsing EPUB:', err);
                reject(err);
            });

            console.log('Starting EPUB parsing...');
            epub.parse();
        });

        if (!result.text.trim()) {
            throw new Error("No valid text content found in the EPUB file");
        }

        console.log('Generating text chunks...');
        const chunks = chunkText(result.text);
        
        if (!chunks.length) {
            throw new Error("Failed to generate text chunks");
        }

        console.log(`Generated ${chunks.length} text chunks`);
        return chunks;
    } catch (error) {
        console.error("Error processing EPUB:", error);
        throw error;
    }
}
