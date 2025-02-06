import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ThemeClassificationResult } from './themeClassifier';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const THEME_CACHE_FILE = path.join(CACHE_DIR, 'theme_classifications.json');

interface CacheEntry {
    timestamp: number;
    result: ThemeClassificationResult;
}

interface ThemeCache {
    [contentHash: string]: CacheEntry;
}

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize cache from file or create new one
let cache: ThemeCache = {};
if (fs.existsSync(THEME_CACHE_FILE)) {
    try {
        cache = JSON.parse(fs.readFileSync(THEME_CACHE_FILE, 'utf-8'));
    } catch (error) {
        console.warn('Error reading theme cache file, starting with empty cache:', error);
    }
}

/**
 * Generate a hash for the content to use as cache key
 */
export function generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Save the current cache to disk
 */
function saveCache(): void {
    try {
        fs.writeFileSync(THEME_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error('Error saving theme cache:', error);
    }
}

/**
 * Get cached theme classification result for content
 * @returns cached result or null if not found
 */
export function getCachedThemes(content: string): ThemeClassificationResult | null {
    const contentHash = generateContentHash(content);
    const cached = cache[contentHash];
    
    if (cached) {
        // Optional: Check if cache is too old (e.g., older than 30 days)
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - cached.timestamp > thirtyDaysMs) {
            delete cache[contentHash];
            saveCache();
            return null;
        }
        return cached.result;
    }
    return null;
}

/**
 * Store theme classification result in cache
 */
export function cacheThemes(content: string, result: ThemeClassificationResult): void {
    const contentHash = generateContentHash(content);
    cache[contentHash] = {
        timestamp: Date.now(),
        result
    };
    saveCache();
}
