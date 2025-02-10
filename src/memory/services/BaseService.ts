import { database } from '../../firebase/config';
import { DatabaseReference, ref, get, set, push, update } from 'firebase/database';
import { FIREBASE_PATHS } from '../constants/config';

/**
 * Base service class providing common Firebase operations
 */
export abstract class BaseService {
    protected getRef(path: string): DatabaseReference {
        return ref(database, path);
    }

    protected async getData<T>(path: string): Promise<T | null> {
        const snapshot = await get(this.getRef(path));
        return snapshot.val() as T;
    }

    protected async setData(path: string, data: any): Promise<void> {
        await set(this.getRef(path), data);
    }

    protected async updateData(path: string, data: any): Promise<void> {
        await update(this.getRef(path), data);
    }

    protected async pushData(path: string, data: any): Promise<string> {
        const newRef = await push(this.getRef(path));
        await set(newRef, data);
        return newRef.key!;
    }

    protected getConversationPath(conversationId: string, subPath?: string): string {
        const basePath = `${FIREBASE_PATHS.conversations}/${conversationId}`;
        return subPath ? `${basePath}/${subPath}` : basePath;
    }
}
