import { openai, GPT4 } from './llm';
import dotenv from "dotenv";
import { getCachedThemes, cacheThemes } from './themeCache';

// Load environment variables
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API Key!");

// Core themes that we'll classify content into
export const CORE_THEMES = [
    'mindfulness',
    'entrepreneurship',
    'philosophy',
    'wealth-building',
    'leadership',
    'productivity',
    'personal-growth',
    'decision-making',
    'relationships',
    'health-wellness',
    'happiness',
];

export interface ThemeClassificationResult {
    themes: string[];
    confidence: { [key: string]: number };
}

/**
 * Uses LLM to classify text into relevant themes
 * @param text The text content to classify
 * @returns Promise<ThemeClassificationResult>
 */
export async function classifyThemes(text: string): Promise<ThemeClassificationResult> {
    try {
        // Check cache first
        const cached = getCachedThemes(text);
        if (cached) {
            console.log('📦 Using cached theme classification');
            return cached;
        }

        console.log('🔍 Analyzing text for theme classification...');
        const prompt = `Analyze the following text and identify which of these themes are present [respond with a JSON object containing 'themes' array and 'confidence' object with scores between 0-1]:\n
Possible themes: ${CORE_THEMES.join(', ')}\n
Text to analyze:\n${text}`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: GPT4,
            temperature: 0,
            response_format: { type: "json_object" }
        });

        console.log('✨ Received response from OpenAI');
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error('No response from OpenAI');
        }

        const result = JSON.parse(response);
        const filteredThemes = result.themes.filter((theme: string) => 
            CORE_THEMES.includes(theme) && 
            result.confidence[theme] >= 0.6
        );
        
        console.log(`📋 Identified themes: ${filteredThemes.length > 0 ? filteredThemes.join(', ') : 'none'}`);
        if (filteredThemes.length > 0) {
            console.log('📊 Confidence scores:');
            filteredThemes.forEach((theme: string) => {
                console.log(`   ${theme}: ${(result.confidence[theme] * 100).toFixed(1)}%`);
            });
        }

        const themeResult: ThemeClassificationResult = {
            themes: filteredThemes,
            confidence: Object.fromEntries(
                Object.entries(result.confidence).filter(([theme, _]) => 
                    CORE_THEMES.includes(theme)
                )
            ) as { [key: string]: number }
        };

        // Cache the result
        cacheThemes(text, themeResult);

        return themeResult;
    } catch (error) {
        console.error('Error classifying themes:', error);
        throw error;
    }
}

/**
 * Batch process multiple chunks for theme classification
 * @param chunks Array of text chunks to classify
 * @param batchSize Number of chunks to process in parallel
 */
export async function batchClassifyThemes(
    chunks: string[], 
    batchSize = 5
): Promise<ThemeClassificationResult[]> {
    const results: ThemeClassificationResult[] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const promises = batch.map(chunk => classifyThemes(chunk));
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
    }
    
    return results;
}
