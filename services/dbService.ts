
import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'ai-assistant-db';
const DB_VERSION = 1;
// Corrected store names to match the keys used in useLocalStorage hook
const STORES = ['ai-assistant-long-article-templates', 'ai-assistant-poster-templates', 'ai-assistant-custom-tools'];

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDb = (): Promise<IDBPDatabase> => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                for (const storeName of STORES) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                }
            },
        });
    }
    return dbPromise;
};

export const dbService = {
    async getAll<T extends {id: string}>(storeName: string): Promise<T[]> {
        try {
            const db = await getDb();
            return await db.getAll(storeName);
        } catch (error) {
            console.error(`Failed to get all items from ${storeName}:`, error);
            return [];
        }
    },
    
    async bulkPut<T extends {id: string}>(storeName: string, items: T[]): Promise<void> {
        if (!items || items.length === 0) return;
        try {
            const db = await getDb();
            const tx = db.transaction(storeName, 'readwrite');
            for (const item of items) {
                tx.store.put(item);
            }
            await tx.done;
        } catch (error) {
            console.error(`Failed to bulk put items to ${storeName}:`, error);
        }
    },

    async clear(storeName: string): Promise<void> {
        try {
            const db = await getDb();
            await db.clear(storeName);
        } catch(error) {
            console.error(`Failed to clear store ${storeName}:`, error);
        }
    }
};
