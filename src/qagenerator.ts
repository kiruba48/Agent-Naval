import { generateText } from './llm';
import fs from 'fs';
import path from 'path';
import { generateContentHash } from './themeCache';
import { QAPair } from './qa_pipeline';
import { readJSONL, appendJSONL } from './fileUtils';

/**
 * Generates a candidate Q&A pair from a text chunk using a language model.
 *
 * @param textChunk - The input text chunk from which to generate a Q&A pair.
 * @param sourceReference - The source reference string indicating where this chunk comes from.
 * @returns A promise that resolves to a Q&A object with question, answer, and sourceReference fields.
 */
const QA_CACHE_FILE = path.join(process.cwd(), 'cache', 'qa_pairs.jsonl');

const QA_CACHE_DIR = path.dirname(QA_CACHE_FILE);
if (!fs.existsSync(QA_CACHE_DIR)) {
  fs.mkdirSync(QA_CACHE_DIR, { recursive: true });
}

// Initialize cache from JSONL file
let qaCache: { [key: string]: any } = {};
const qaCacheEntries = readJSONL(QA_CACHE_FILE);
qaCacheEntries.forEach(entry => {
  if (entry.key && entry.value) {
    qaCache[entry.key] = entry.value;
  }
});

function saveQAToCache(key: string, value: any): void {
  qaCache[key] = value;
  appendJSONL(QA_CACHE_FILE, { key, value });
}

export async function generateQAPair(textChunk: string, sourceReference: string): Promise<QAPair> {
  // Compute a unique key for this text chunk using the existing generateContentHash
  const cacheKey = generateContentHash(textChunk + sourceReference);

  console.log(`[QAGenerator] Checking cache for key: ${cacheKey}`);
  // Check if result exists in cache
  if (qaCache[cacheKey]) {
    console.log(`[QAGenerator] Cache hit for key: ${cacheKey}`);
    return qaCache[cacheKey];
  }

  console.log(`[QAGenerator] No cache found for key: ${cacheKey}. Generating new Q&A pair.`);
  // Construct a prompt to generate a Q&A pair. We instruct the model to output valid JSON.
  const prompt = `You are an assistant tasked with generating a high-quality question and answer pair for fine-tuning a language model. The Q&A pair should be directly supported by the provided text. Please follow these rules:
1. The question should be clear and concise.
2. The answer should accurately reflect the content of the text.
3. Output a JSON object with the keys \"question\", \"answer\", and \"source_reference\". Set the \"source_reference\" to the provided source reference.

Text: "${textChunk}"

Source Reference: "${sourceReference}"

Respond with only the JSON object.
`;

  console.log(`[QAGenerator] Prompt constructed. Calling LLM...`);
  // Call the language model to generate text based on the prompt.
  const response = await generateText(prompt);
  console.log(`[QAGenerator] Response received from LLM: ${response.substring(0, 100)}...`);

  // Attempt to parse the response as JSON
  try {
    let trimmedResponse = response.trim();
    // Remove markdown code fences if present
    if (trimmedResponse.startsWith("```json")) {
      trimmedResponse = trimmedResponse.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    } else if (trimmedResponse.startsWith("```")) {
      trimmedResponse = trimmedResponse.replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    }
    console.log(`[QAGenerator] Trimmed response for parsing: ${trimmedResponse.substring(0, 100)}...`);
    const qaPair = JSON.parse(trimmedResponse);
    // Ensure the source_reference is set to our provided value
    qaPair.source_reference = sourceReference;

    console.log(`[QAGenerator] Q&A pair successfully parsed. Saving to cache with key: ${cacheKey}`);
    saveQAToCache(cacheKey, qaPair);

    return qaPair;
  } catch (error) {
    // If parsing fails, return a default response or throw an error
    console.error(`[QAGenerator] Error parsing Q&A response: ${error}`);
    throw new Error(`Failed to parse Q&A pair from LLM response. Response received: ${response}`);
  }
}

/**
 * Generates candidate Q&A pairs for an array of text chunks.
 *
 * @param textChunks - An array of objects containing text and their source reference.
 * @returns A promise that resolves to an array of Q&A objects.
 */
export async function generateQAPairsForChunks(textChunks: { text: string; sourceReference: string }[]): Promise<QAPair[]> {
  const qaPairs = [];
  for (const chunk of textChunks) {
    try {
      const qaPair = await generateQAPair(chunk.text, chunk.sourceReference);
      qaPairs.push(qaPair);
    } catch (error) {
      console.error('Error generating Q&A pair for chunk:', error);
    }
  }
  return qaPairs;
}
