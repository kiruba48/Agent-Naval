import fs from 'fs';
import path from 'path';

/**
 * Writes data to a file in JSONL format, where each line is a valid JSON object
 * @param filePath - Path to the output file
 * @param data - Array of objects to write
 */
export function writeJSONL(filePath: string, data: any[]): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const stream = fs.createWriteStream(filePath);
    data.forEach(item => {
        stream.write(JSON.stringify(item) + '\n');
    });
    stream.end();
}

/**
 * Reads data from a JSONL file
 * @param filePath - Path to the JSONL file
 * @returns Array of parsed JSON objects
 */
export function readJSONL(filePath: string): any[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
}

/**
 * Appends a single object to a JSONL file
 * @param filePath - Path to the JSONL file
 * @param data - Object to append
 */
export function appendJSONL(filePath: string, data: any): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(filePath, JSON.stringify(data) + '\n');
}
