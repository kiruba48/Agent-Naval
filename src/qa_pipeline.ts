import { processFile } from './processFile';
import { generateQAPairsForChunks } from './qagenerator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

// Define the base Q&A pair interface
export interface QAPair {
  question: string;
  answer: string;
  source_reference: string;
  requiresReview?: boolean;  // Make it optional since not all QAPairs will have this initially
}

// Extended interface that includes the review flag
export interface FinalQAPair extends QAPair {
  requiresReview: boolean;  // Required in final pairs
}

/**
 * Automated quality check for a Q&A pair.
 * Returns true if the Q&A pair requires human review, false if it passes the checks.
 */
function checkQAPairQuality(qaPair: QAPair & { requiresReview?: boolean }): boolean {
  let requiresReview = false;

  // EmptyOrShortFieldCheck: Check if question or answer have fewer than 5 words
  const questionWordCount = qaPair.question.split(/\s+/).filter(Boolean).length;
  const answerWordCount = qaPair.answer.split(/\s+/).filter(Boolean).length;
  if (questionWordCount < 5 || answerWordCount < 5) {
    console.log('[QualityCheck] Failed EmptyOrShortFieldCheck');
    requiresReview = true;
  }

  // DuplicateContentCheck / QuestionEchoCheck: Check if answer is the same as question
  if (qaPair.question.trim().toLowerCase() === qaPair.answer.trim().toLowerCase()) {
    console.log('[QualityCheck] Failed QuestionEchoCheck: Answer is identical to question');
    requiresReview = true;
  }

  // QuestionAnswerLengthRatioCheck: Check if answer length ratio is abnormal, using a ratio threshold
  const ratio = answerWordCount / (questionWordCount || 1);
  if (ratio < 0.5 || ratio > 3) {
    console.log(`[QualityCheck] Failed QuestionAnswerLengthRatioCheck: Ratio is ${ratio.toFixed(2)}`);
    requiresReview = true;
  }

  // StopWordPlaceholderCheck: Check for placeholder text in answer
  const placeholders = ['lorem ipsum', 'fill this in'];
  for (const placeholder of placeholders) {
    if (qaPair.answer.toLowerCase().includes(placeholder)) {
      console.log('[QualityCheck] Failed StopWordPlaceholderCheck: Found placeholder text');
      requiresReview = true;
      break;
    }
  }

  // SourceReferenceCheck: Ensure source_reference is valid
  if (!qaPair.source_reference || qaPair.source_reference.toLowerCase() === 'unknown source') {
    console.log('[QualityCheck] Failed SourceReferenceCheck: Invalid source reference');
    requiresReview = true;
  }

  // Additional semantic/factual checks could be added here
  // For now, we log that they're not implemented
  // console.log('[QualityCheck] KeywordOverlapCheck, ChunkTopicAlignmentCheck, NamedEntityMismatchCheck are not implemented yet.');

  return requiresReview;
}

/**
 * Runs the Q&A generation pipeline.
 * 
 * Steps:
 * 1. Process the input file(s) to extract text chunks. Each chunk contains metadata including a source reference.
 * 2. Map each chunk to { text, sourceReference } required by Q&A generator.
 * 3. Generate candidate Q&A pairs using the language model (with caching and logging in place).
 * 4. Run automated quality checks to flag Q&A pairs for human review.
 * 5. Save the resulting Q&A pairs in a JSON file for later fine-tuning.
 * 
 * @param filePaths - A string or an array of file paths (PDF, EPUB, or TXT) to process.
 * @returns A promise that resolves to an array of generated Q&A pairs.
 */

async function runQAPipeline(filePaths: string | string[]): Promise<FinalQAPair[]> {
  console.log(`[QAPipeline] Processing file(s): ${Array.isArray(filePaths) ? filePaths.join(', ') : filePaths}`);
  
  const chunks = await processFile(filePaths);
  console.log(`[QAPipeline] Obtained ${chunks.length} text chunk(s) from document(s).`);

  // Map each chunk to an object with text and sourceReference for Q&A generation
  const chunkData = chunks.map(chunk => ({
    text: chunk.content,
    sourceReference: chunk.metadata.sourceReference || 'Unknown Source'
  }));

  console.log(`[QAPipeline] Generating Q&A pairs from text chunks...`);
  let qaPairs: QAPair[] = await generateQAPairsForChunks(chunkData);
  console.log(`[QAPipeline] Generated ${qaPairs.length} Q&A pair(s).`);

  // Ensure all QA pairs have requiresReview set
  const finalQAPairs: FinalQAPair[] = qaPairs.map(pair => ({
    ...pair,
    requiresReview: pair.requiresReview ?? checkQAPairQuality(pair)
  }));

  const approvedCount = finalQAPairs.filter(pair => !pair.requiresReview).length;
  const reviewCount = finalQAPairs.filter(pair => pair.requiresReview).length;
  console.log(`[QAPipeline] Quality Check: ${approvedCount} approved, ${reviewCount} flagged for review.`);

  // Save the Q&A pairs to an output JSON file
  const outputFile = path.join(process.cwd(), 'output', 'qa_pairs.json');
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[QAPipeline] Created output directory: ${outputDir}`);
  }
  fs.writeFileSync(outputFile, JSON.stringify(finalQAPairs, null, 2));
  console.log(`[QAPipeline] Q&A pairs saved to ${outputFile}`);

  return finalQAPairs;
}

// If this module is run directly, take file paths from command line arguments.
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('[QAPipeline] No file paths provided. Usage: npx tsx src/qa_pipeline.ts <file1> <file2> ...');
    process.exit(1);
  }

  runQAPipeline(args).catch(err => {
    console.error('[QAPipeline] Error:', err);
    process.exit(1);
  });
}

export { runQAPipeline, checkQAPairQuality };
