import { spawn } from 'child_process';

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

interface ThemeClassificationResult {
    themes: string[];
    confidence: { [key: string]: number };
}

// Singleton LLM service process
let llmServiceProcess: ReturnType<typeof spawn> | null = null;
let isServiceReady = false;

function getLLMService() {
    if (!llmServiceProcess) {
        llmServiceProcess = spawn('./venv/bin/python', ['./tools/llm_service.py']);
        
        if (llmServiceProcess && llmServiceProcess.stderr) {
            llmServiceProcess.stderr.on('data', (data) => {
                console.error('LLM Service Error:', data.toString());
            });
        }

        if (llmServiceProcess) {
            llmServiceProcess.on('exit', (code) => {
                console.log('LLM Service exited with code:', code);
                llmServiceProcess = null;
                isServiceReady = false;
            });
        }

        isServiceReady = true;
    }
    return llmServiceProcess;
}

/**
 * Uses LLM to classify text into relevant themes
 * @param text The text content to classify
 * @returns Promise<ThemeClassificationResult>
 */
export async function classifyThemes(text: string): Promise<ThemeClassificationResult> {
    return new Promise((resolve, reject) => {
        const service = getLLMService();
        if (!service || !service.stdin || !service.stdout) {
            reject(new Error('Failed to start LLM service'));
            return;
        }

        if (!service.stdout) {
            throw new Error('LLM service stdout is not available');
        }
        
        let output = '';

        const prompt = `Analyze the following text and identify which of these themes are present [respond with a JSON object containing 'themes' array and 'confidence' object with scores between 0-1]:\n
Themes: mindfulness, entrepreneurship, philosophy, wealth-building, leadership, productivity, personal-growth, decision-making, relationships, health-wellness, happiness\n
Text: "${text.replace(/"/g, '\\"')}"\n
Expected format:
{
    "themes": ["theme1", "theme2"],
    "confidence": {
        "theme1": 0.8,
        "theme2": 0.7
    }
}`;

        // Send request to service
        const request = {
            prompt,
            model: 'gpt-4'
        };
        
        service.stdin.write(JSON.stringify(request) + '\n');

        const responseHandler = (data: Buffer) => {
            const chunk = data.toString();
            try {
                const response = JSON.parse(chunk);
                if (response.error) {
                    service.stdout!.removeListener('data', responseHandler);
                    reject(new Error(response.error));
                } else if (response.response) {
                    service.stdout!.removeListener('data', responseHandler);
                    const result = JSON.parse(response.response);
                    resolve({
                        themes: result.themes.filter((theme: string) => 
                            CORE_THEMES.includes(theme) && 
                            result.confidence[theme] >= 0.6
                        ),
                        confidence: result.confidence
                    });
                }
            } catch (e) {
                output += chunk;
            }
        };

        service.stdout.on('data', responseHandler);
    });
}

/**
 * Batch process multiple chunks for theme classification
 * @param chunks Array of text chunks to classify
 * @param batchSize Number of chunks to process in parallel
 */
export async function batchClassifyThemes(chunks: string[], batchSize = 5): Promise<ThemeClassificationResult[]> {
    const results: ThemeClassificationResult[] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(chunk => classifyThemes(chunk)));
        results.push(...batchResults);
    }
    return results;
}
