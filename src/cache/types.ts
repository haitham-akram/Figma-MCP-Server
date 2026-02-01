/**
 * Cache Type Definitions
 */

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    version?: string;
}

export interface CacheProvider {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl: number): Promise<void>;
    delete(key: string): Promise<void>;
    invalidate(pattern: string): Promise<number>;
    clear(): Promise<void>;
    size(): Promise<number>;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

export interface CacheConfig {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    ttlByType: {
        file: number;
        components: number;
        tokens: number;
        plan: number;
    };
}
