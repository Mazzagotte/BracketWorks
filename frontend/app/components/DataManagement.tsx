import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToastHelpers } from './Toast';

// Auto-save hook
interface UseAutoSaveOptions<T> {
  data: T;
  saveFunction: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useAutoSave<T>({
  data,
  saveFunction,
  delay = 2000,
  enabled = true,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions<T>) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const dataRef = useRef(data);
  const { info, error: showError } = useToastHelpers();

  // Update data reference
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const save = useCallback(async () => {
    if (!enabled || saving) return;

    try {
      setSaving(true);
      onSaveStart?.();
      
      await saveFunction(dataRef.current);
      
      setLastSaved(new Date());
      onSaveSuccess?.();
      info('Changes saved automatically', '', { duration: 2000 });
    } catch (err: any) {
      onSaveError?.(err);
      showError('Failed to save changes automatically', 'Auto-save Error');
    } finally {
      setSaving(false);
    }
  }, [saveFunction, enabled, saving, onSaveStart, onSaveSuccess, onSaveError, info, showError]);

  // Set up auto-save timer
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(save, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, save, delay, enabled]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return save();
  }, [save]);

  return {
    saving,
    lastSaved,
    saveNow,
  };
}

// Offline storage manager
class OfflineStorageManager {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  // Store data offline
  store<T>(key: string, data: T): void {
    try {
      const offlineData = this.getOfflineData();
      offlineData[key] = {
        data,
        timestamp: new Date().toISOString(),
        synced: false,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  // Retrieve data from offline storage
  retrieve<T>(key: string): T | null {
    try {
      const offlineData = this.getOfflineData();
      const item = offlineData[key];
      return item ? item.data : null;
    } catch (error) {
      console.error('Failed to retrieve offline data:', error);
      return null;
    }
  }

  // Get all unsynced items
  getUnsyncedItems(): Array<{ key: string; data: any; timestamp: string }> {
    try {
      const offlineData = this.getOfflineData();
      return Object.entries(offlineData)
        .filter(([, item]) => !item.synced)
        .map(([key, item]) => ({
          key,
          data: item.data,
          timestamp: item.timestamp,
        }));
    } catch (error) {
      console.error('Failed to get unsynced items:', error);
      return [];
    }
  }

  // Mark item as synced
  markSynced(key: string): void {
    try {
      const offlineData = this.getOfflineData();
      if (offlineData[key]) {
        offlineData[key].synced = true;
        localStorage.setItem(this.storageKey, JSON.stringify(offlineData));
      }
    } catch (error) {
      console.error('Failed to mark item as synced:', error);
    }
  }

  // Clear all offline data
  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  // Get raw offline data
  private getOfflineData(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to parse offline data:', error);
      return {};
    }
  }
}

// Offline sync hook
interface UseOfflineSyncOptions {
  syncFunction: (data: any) => Promise<void>;
  storageKey?: string;
  syncInterval?: number;
}

export function useOfflineSync({
  syncFunction,
  storageKey = 'offline-data',
  syncInterval = 30000, // 30 seconds
}: UseOfflineSyncOptions) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);
  const storageManager = useRef(new OfflineStorageManager(storageKey));
  const { success, error: showError } = useToastHelpers();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending items when coming back online
  const syncPendingItems = useCallback(async () => {
    if (!isOnline || syncing) return;

    const unsyncedItems = storageManager.current.getUnsyncedItems();
    if (unsyncedItems.length === 0) return;

    setSyncing(true);
    let syncedCount = 0;

    try {
      for (const item of unsyncedItems) {
        await syncFunction(item.data);
        storageManager.current.markSynced(item.key);
        syncedCount++;
      }

      success(`Synced ${syncedCount} pending changes`, 'Sync Complete');
      setPendingItems(0);
    } catch (error: any) {
      showError('Failed to sync some changes', 'Sync Error');
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, syncFunction, success, showError]);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline) {
      syncPendingItems();
    }
  }, [isOnline, syncPendingItems]);

  // Periodic sync
  useEffect(() => {
    if (!isOnline || syncInterval <= 0) return;

    const interval = setInterval(syncPendingItems, syncInterval);
    return () => clearInterval(interval);
  }, [isOnline, syncInterval, syncPendingItems]);

  // Update pending items count
  useEffect(() => {
    const updatePendingCount = () => {
      const count = storageManager.current.getUnsyncedItems().length;
      setPendingItems(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 1000);
    return () => clearInterval(interval);
  }, []);

  // Store data offline
  const storeOffline = useCallback(<T extends unknown>(key: string, data: T) => {
    storageManager.current.store(key, data);
    setPendingItems(prev => prev + 1);
  }, []);

  // Retrieve data from offline storage
  const retrieveOffline = useCallback(<T extends unknown>(key: string): T | null => {
    return storageManager.current.retrieve(key);
  }, []);

  return {
    isOnline,
    syncing,
    pendingItems,
    storeOffline,
    retrieveOffline,
    syncNow: syncPendingItems,
  };
}

// Smart cache hook with LRU eviction
interface CacheItem<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export function useSmartCache<T extends unknown>(maxSize: number = 50) {
  const cache = useRef<Map<string, CacheItem<T>>>(new Map());

  const set = useCallback((key: string, data: T) => {
    const now = Date.now();
    
    // If cache is full, evict least recently used item
    if (cache.current.size >= maxSize) {
      let lruKey = '';
      let lruTime = Infinity;
      
      for (const [k, item] of cache.current.entries()) {
        if (item.lastAccessed < lruTime) {
          lruTime = item.lastAccessed;
          lruKey = k;
        }
      }
      
      if (lruKey) {
        cache.current.delete(lruKey);
      }
    }

    cache.current.set(key, {
      data,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now,
    });
  }, [maxSize]);

  const get = useCallback((key: string): T | null => {
    const item = cache.current.get(key);
    
    if (item) {
      // Update access statistics
      item.accessCount++;
      item.lastAccessed = Date.now();
      return item.data;
    }
    
    return null;
  }, []);

  const remove = useCallback((key: string) => {
    cache.current.delete(key);
  }, []);

  const clear = useCallback(() => {
    cache.current.clear();
  }, []);

  const has = useCallback((key: string) => {
    return cache.current.has(key);
  }, []);

  const size = useCallback(() => {
    return cache.current.size;
  }, []);

  return { set, get, remove, clear, has, size };
}

// Persistent state hook that survives page refreshes
export function usePersistentState<T extends unknown>(
  key: string,
  defaultValue: T,
  storage: 'localStorage' | 'sessionStorage' = 'localStorage'
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
      const item = storageObj.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from ${storage}:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
      storageObj.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to save ${key} to ${storage}:`, error);
    }
  }, [key, state, storage]);

  return [state, setState];
}

// Debounced value hook
export function useDebouncedValue<T extends unknown>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Data synchronization status component
interface SyncStatusProps {
  isOnline: boolean;
  syncing: boolean;
  pendingItems: number;
  lastSynced?: Date;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  isOnline,
  syncing,
  pendingItems,
  lastSynced,
}) => {
  if (!isOnline && pendingItems === 0) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
        Offline
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="flex items-center text-sm text-blue-600">
        <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Syncing...
      </div>
    );
  }

  if (pendingItems > 0) {
    return (
      <div className="flex items-center text-sm text-yellow-600">
        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
        {pendingItems} pending changes
      </div>
    );
  }

  return (
    <div className="flex items-center text-sm text-green-600">
      <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
      {isOnline ? 'All changes saved' : 'Offline'}
      {lastSynced && (
        <span className="ml-2 text-gray-500">
          Last synced {lastSynced.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};