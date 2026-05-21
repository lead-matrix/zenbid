export interface OfflineJob {
  id: string;
  jobType: string;
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;
  scheduledAt: string;
  createdAt: string;
}

export interface OfflineDraft {
  id: string;
  type: 'project' | 'item' | 'notes';
  data: any;
  updatedAt: string;
}

export interface OfflineMedia {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  blob: Blob;
  previewUrl?: string;
  createdAt: string;
}

class IndexedDBManager {
  private dbName = 'ZenBidOfflineCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initializes the IndexedDB database structure
   */
  private init(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Offline jobs store
        if (!db.objectStoreNames.contains('jobs')) {
          db.createObjectStore('jobs', { keyPath: 'id' });
        }
        
        // Offline drafts store
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        
        // Large media files (photos, voice notes) store
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Database failed to open:', event);
        reject(new Error('IndexedDB initialization failed'));
      };
    });
  }

  /**
   * Run a transaction on a specific store
   */
  private async getStore(
    storeName: 'jobs' | 'drafts' | 'media',
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Set or update a value in a store
   */
  public async put<T>(storeName: 'jobs' | 'drafts' | 'media', val: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(val);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get a single record by ID
   */
  public async get<T>(storeName: 'jobs' | 'drafts' | 'media', id: string): Promise<T | null> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all records from a store
   */
  public async getAll<T>(storeName: 'jobs' | 'drafts' | 'media'): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete a record by ID
   */
  public async delete(storeName: 'jobs' | 'drafts' | 'media', id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Clear all records in a store
   */
  public async clear(storeName: 'jobs' | 'drafts' | 'media'): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineDB = new IndexedDBManager();
