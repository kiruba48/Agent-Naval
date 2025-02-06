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

  // QuestionTypeCheck: Check if the question starts with appropriate question words
  const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 'explain', 'describe', 'can', 'does', 'do'];
  const startsWithQuestionWord = questionWords.some(word => 
    qaPair.question.toLowerCase().trim().startsWith(word)
  );
  if (!startsWithQuestionWord) {
    console.log('[QualityCheck] Failed QuestionTypeCheck: Question does not start with a question word');
    requiresReview = true;
  }

  // KeywordOverlapCheck: Check if key terms from the question appear in the answer
  const stopWords = new Set([
    // Question words
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    // Common verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'will', 'would', 'should', 'must',
    // Common prepositions
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of',
    // Common articles and conjunctions
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
    // Common adjectives
    'this', 'that', 'these', 'those',
    // Common question starters
    'explain', 'describe', 'discuss', 'list', 'define',
    // Common qualifiers
    'according', 'considered', 'regarding'
  ]);
  
  // Get word variations (simple version - handle common word forms)
  const getWordVariations = (words: string[]) => {
    const variations = new Set<string>();
    
    words.forEach(word => {
      // Add original word
      variations.add(word);
      
      // Handle common suffixes
      const commonSuffixes = ['ing', 'ed', 's', 'es', 'er', 'est', 'ly', 'ment', 'ness', 'ity', 'tion', 'sion'];
      const wordBase = word.toLowerCase();
      
      // Try removing each suffix and add the base form
      for (const suffix of commonSuffixes) {
        if (wordBase.endsWith(suffix) && wordBase.length > suffix.length + 3) {
          const base = wordBase.slice(0, -suffix.length);
          variations.add(base);
          
          // Add common variations of the base
          if (suffix === 's' || suffix === 'es') {
            variations.add(base + 'ing');  // plural -> gerund
            variations.add(base + 'ed');   // plural -> past tense
          } else if (suffix === 'ing') {
            variations.add(base + 'e');    // running -> run
            variations.add(base + 'ed');   // running -> ran
          } else if (suffix === 'ed') {
            variations.add(base + 'ing');  // walked -> walking
            variations.add(base + 'e');    // walked -> walk
          }
        }
      }
      
      // Handle 'y' to 'i' transformation
      if (wordBase.endsWith('y')) {
        const base = wordBase.slice(0, -1);
        variations.add(base + 'ies');  // study -> studies
        variations.add(base + 'ied');  // study -> studied
        variations.add(base + 'ier');  // happy -> happier
        variations.add(base + 'iest'); // happy -> happiest
      }
      
      // Handle common prefixes by removing them
      const commonPrefixes = ['un', 'in', 'im', 'ir', 're', 'dis', 'pre', 'pro', 'non'];
      for (const prefix of commonPrefixes) {
        if (wordBase.startsWith(prefix) && wordBase.length > prefix.length + 3) {
          variations.add(wordBase.slice(prefix.length));
        }
      }
    });
    
    return variations;
  };
  
  const questionKeywords = qaPair.question.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)  // Filter out short words
    .filter(word => !stopWords.has(word))
    .map(word => word.replace(/[^a-z]/g, '')); // Remove non-alphabetic characters
  
  const answerWords = qaPair.answer.toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^a-z]/g, '')); // Remove non-alphabetic characters
  
  const questionVariations = getWordVariations(questionKeywords);
  const answerVariations = getWordVariations(answerWords);
  
  // Check for semantic overlap using word variations and partial matches
  const hasKeywordOverlap = questionVariations.size === 0 || // Skip check if no keywords found
    Array.from(questionVariations).some(qWord => 
      answerVariations.has(qWord) || 
      Array.from(answerVariations).some(aWord => {
        // Only consider meaningful partial matches
        if (qWord.length < 4 || aWord.length < 4) return false;
        // Check both directions with a minimum length requirement
        const minMatchLength = Math.min(4, Math.floor(Math.min(qWord.length, aWord.length) * 0.75));
        return (qWord.includes(aWord) && aWord.length >= minMatchLength) || 
               (aWord.includes(qWord) && qWord.length >= minMatchLength);
      })
    );
  
  if (!hasKeywordOverlap) {
    console.log('[QualityCheck] Failed KeywordOverlapCheck: Answer does not contain key terms from question');
    console.log(`[QualityCheck] Question keywords: ${Array.from(questionVariations).join(', ')}`);
    requiresReview = true;
  }

  // AnswerCompletenessCheck: Check if answer appears to be complete
  const properEndingPunctuation = ['.', '!', '?'];
  const hasProperEnding = properEndingPunctuation.some(punct => 
    qaPair.answer.trim().endsWith(punct)
  );
  const minSentences = 1;
  const sentences = qaPair.answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (!hasProperEnding || sentences.length < minSentences) {
    console.log('[QualityCheck] Failed AnswerCompletenessCheck: Answer may be incomplete');
    requiresReview = true;
  }

  // DuplicateContentCheck / QuestionEchoCheck: Check if answer is the same as question
  if (qaPair.question.trim().toLowerCase() === qaPair.answer.trim().toLowerCase()) {
    console.log('[QualityCheck] Failed QuestionEchoCheck: Answer is identical to question');
    requiresReview = true;
  }

  // QuestionAnswerLengthRatioCheck: Check if answer length ratio is abnormal, using a ratio threshold
  const ratio = answerWordCount / (questionWordCount || 1);
  if (ratio < 0.5 || ratio > 6) {  
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
