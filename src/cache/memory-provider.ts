/**
 * In-Memory Cache Provider (L1 Cache)
 * 
 * Features:
 * - TTL-based expiration
 * - LRU eviction when max size reached
 * - Pattern-based invalidation
 */

import { CacheProvider, CacheEntry } from './types.js';

export class MemoryCacheProvider implements CacheProvider {
    private cache: Map<string, CacheEntry<unknown>>;
    private accessOrder: string[]; // For LRU tracking
    private maxSize: number;
    private stats = {
        hits: 0,
        misses: 0,
    };

    constructor(maxSize: number = 100) {
        this.cache = new Map();
        this.accessOrder = [];
        this.maxSize = maxSize;
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        const now = Date.now();
        const age = now - entry.timestamp;
        if (age > entry.ttl * 1000) {
            // Expired - remove and return null
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.stats.misses++;
            return null;
        }

        // Update LRU order
        this.updateAccessOrder(key);
        this.stats.hits++;
        return entry.data;
    }

    async set<T>(key: string, value: T, ttl: number): Promise<void> {
        // Evict LRU entry if at max size
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        const entry: CacheEntry<T> = {
            data: value,
            timestamp: Date.now(),
            ttl,
        };

        this.cache.set(key, entry as CacheEntry<unknown>);
        this.updateAccessOrder(key);
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
    }

    async invalidate(pattern: string): Promise<number> {
        let count = 0;
        const regex = this.patternToRegex(pattern);

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                count++;
            }
        }

        return count;
    }

    async clear(): Promise<void> {
        this.cache.clear();
        this.accessOrder = [];
        this.stats.hits = 0;
        this.stats.misses = 0;
    }

    async size(): Promise<number> {
        return this.cache.size;
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    // LRU helpers

    private updateAccessOrder(key: string): void {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    private removeFromAccessOrder(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    private evictLRU(): void {
        if (this.accessOrder.length > 0) {
            const lruKey = this.accessOrder[0];
            this.cache.delete(lruKey);
            this.accessOrder.shift();
        }
    }

    private patternToRegex(pattern: string): RegExp {
        // Convert glob-like pattern to regex
        // Example: "abc123:*:file" -> /^abc123:.*:file$/
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
            .replace(/\*/g, '.*'); // Convert * to .*
        return new RegExp(`^${escaped}$`);
    }
}
