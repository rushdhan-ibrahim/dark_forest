// Persistence utilities for storing reader state across sessions

const STORAGE_PREFIX = 'dark-forest-';
const EXPIRY_DAYS = 30;

interface StoredData<T> {
    data: T;
    timestamp: number;
}

function isExpired(timestamp: number): boolean {
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryMs;
}

export function saveData<T>(key: string, data: T): void {
    try {
        const stored: StoredData<T> = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(stored));
    } catch {
        // localStorage might be full or disabled
        console.warn('Failed to save to localStorage:', key);
    }
}

export function loadData<T>(key: string): T | null {
    try {
        const item = localStorage.getItem(STORAGE_PREFIX + key);
        if (!item) return null;

        const stored: StoredData<T> = JSON.parse(item);

        if (isExpired(stored.timestamp)) {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return null;
        }

        return stored.data;
    } catch {
        return null;
    }
}

export function clearData(key: string): void {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
        // Ignore errors
    }
}

// Star Memory specific functions
const STAR_MEMORY_KEY = 'star-memory';
let starMemoryCache: Set<string> | null = null;

export function getStarMemory(): Set<string> {
    if (starMemoryCache) return starMemoryCache;

    const stored = loadData<string[]>(STAR_MEMORY_KEY);
    starMemoryCache = stored ? new Set(stored) : new Set();
    return starMemoryCache;
}

export function rememberStar(layerIndex: number, starIndex: number): void {
    const memory = getStarMemory();
    const key = `${layerIndex}-${starIndex}`;

    if (!memory.has(key)) {
        memory.add(key);
        // Limit to 200 stars to prevent bloat
        if (memory.size > 200) {
            const firstKey = memory.values().next().value as string;
            memory.delete(firstKey);
        }
        saveData(STAR_MEMORY_KEY, Array.from(memory));
    }
}

export function isStarRemembered(layerIndex: number, starIndex: number): boolean {
    const memory = getStarMemory();
    return memory.has(`${layerIndex}-${starIndex}`);
}

export function getRememberedStarCount(): number {
    return getStarMemory().size;
}

export function clearStarMemory(): void {
    starMemoryCache = null;
    clearData(STAR_MEMORY_KEY);
}
