import { database } from '../../firebase/config';
import { DatabaseReference, ref, get, set, push, update } from 'firebase/database';
import { FIREBASE_PATHS } from '../constants/config';
import { logger } from '../../utils/logger';

/**
 * Base service class providing common Firebase operations
 */
export abstract class BaseService {
    protected getRef(path: string): DatabaseReference {
        return ref(database, path);
    }

    protected async getData<T>(path: string): Promise<T | null> {
        const snapshot = await get(this.getRef(path));
        const data = snapshot.val() as T;
        return data ? this.convertTimestamps(data) : null;
    }

    protected async setData(path: string, data: any): Promise<void> {
        await set(this.getRef(path), this.convertDatesToISOStrings(data));
    }

    protected async updateData(path: string, data: any): Promise<void> {
        await update(this.getRef(path), this.convertDatesToISOStrings(data));
    }

    protected async pushData(path: string, data: any): Promise<string> {
        const newRef = await push(this.getRef(path));
        await set(newRef, this.convertDatesToISOStrings(data));
        return newRef.key!;
    }

    protected getConversationPath(conversationId: string, subPath?: string): string {
        const basePath = `${FIREBASE_PATHS.conversations}/${conversationId}`;
        return subPath ? `${basePath}/${subPath}` : basePath;
    }

    /**
     * Recursively converts ISO timestamp strings to Date objects
     * This helps ensure consistent date handling across the application
     */
    protected convertTimestamps<T>(data: T): T {
        if (!data) return data;
        
        // Handle string timestamps (ISO format)
        if (typeof data === 'string') {
            // Check if string is an ISO date format
            const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
            if (isoDatePattern.test(data)) {
                return new Date(data) as unknown as T;
            }
            return data;
        }
        
        // Handle numeric timestamps (milliseconds since epoch)
        if (typeof data === 'number' && !isNaN(data)) {
            // Check if it's a reasonable timestamp (between 2000 and 2100)
            const year2000 = 946684800000; // Jan 1, 2000
            const year2100 = 4102444800000; // Jan 1, 2100
            
            if (data > year2000 && data < year2100) {
                return new Date(data) as unknown as T;
            }
            return data;
        }
        
        // Handle objects
        if (typeof data === 'object') {
            // Already a Date
            if (data instanceof Date) return data;
            
            // Handle arrays
            if (Array.isArray(data)) {
                return data.map(item => this.convertTimestamps(item)) as unknown as T;
            }
            
            // Handle Firebase timestamp-like objects
            // Firebase may store timestamps as objects with properties like
            // { seconds: 1234567890, nanoseconds: 123456789 }
            if (data !== null && 'seconds' in data && 'nanoseconds' in data) {
                const seconds = (data as any).seconds;
                const nanoseconds = (data as any).nanoseconds;
                
                if (typeof seconds === 'number' && typeof nanoseconds === 'number') {
                    // Convert to milliseconds and create Date
                    const milliseconds = seconds * 1000 + nanoseconds / 1000000;
                    return new Date(milliseconds) as unknown as T;
                }
            }
            
            // Recursively process object properties
            const result = { ...data } as any;
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    result[key] = this.convertTimestamps(result[key]);
                }
            }
            return result as T;
        }
        
        return data;
    }

    /**
     * Recursively converts Date objects to ISO strings for Firebase storage
     */
    protected convertDatesToISOStrings(data: any): any {
        if (!data) return data;
        
        if (data instanceof Date) {
            return data.toISOString();
        }
        
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data.map(item => this.convertDatesToISOStrings(item));
            }
            
            const result = { ...data };
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    result[key] = this.convertDatesToISOStrings(result[key]);
                }
            }
            return result;
        }
        
        return data;
    }
}
