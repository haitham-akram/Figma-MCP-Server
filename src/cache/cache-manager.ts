/**
 * Cache Manager
 * 
 * High-level API for caching with type-specific TTLs
 */

import { CacheProvider, CacheConfig, CacheStats } from './types.js';
import { MemoryCacheProvider } from './memory-provider.js';

export class CacheManager {
    private provider: CacheProvider;
    private config: CacheConfig;

    constructor(config: CacheConfig, provider?: CacheProvider) {
        this.config = config;
        this.provider = provider || new MemoryCacheProvider(config.maxSize);
    }

    /**
     * Get cached value
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.config.enabled) {
            return null;
        }
        return this.provider.get<T>(key);
    }

    /**
     * Set cached value with type-specific TTL
     */
    async set<T>(key: string, value: T, type?: keyof CacheConfig['ttlByType']): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const ttl = type ? this.config.ttlByType[type] : this.config.defaultTTL;
        await this.provider.set(key, value, ttl);
    }

    /**
     * Delete specific key
     */
    async delete(key: string): Promise<void> {
        await this.provider.delete(key);
    }

    /**
     * Invalidate keys matching pattern
     */
    async invalidate(pattern: string): Promise<number> {
        return this.provider.invalidate(pattern);
    }

    /**
     * Clear entire cache
     */
    async clear(): Promise<void> {
        await this.provider.clear();
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        if (this.provider instanceof MemoryCacheProvider) {
            return this.provider.getStats();
        }

        const size = await this.provider.size();
        return {
            hits: 0,
            misses: 0,
            size,
            hitRate: 0,
        };
    }

    /**
     * Generate cache key for Figma file
     */
    static fileKey(fileKey: string, version?: string): string {
        return version ? `${fileKey}:${version}:file` : `${fileKey}:latest:file`;
    }

    /**
     * Generate cache key for components
     */
    static componentsKey(fileKey: string, version?: string, filters?: Record<string, unknown>): string {
        const base = version ? `${fileKey}:${version}:components` : `${fileKey}:latest:components`;
        if (filters && Object.keys(filters).length > 0) {
            const filterStr = Object.entries(filters)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
            return `${base}:${filterStr}`;
        }
        return base;
    }

    /**
     * Generate cache key for tokens
     */
    static tokensKey(fileKey: string, version?: string, filters?: Record<string, unknown>): string {
        const base = version ? `${fileKey}:${version}:tokens` : `${fileKey}:latest:tokens`;
        if (filters && Object.keys(filters).length > 0) {
            const filterStr = Object.entries(filters)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
            return `${base}:${filterStr}`;
        }
        return base;
    }

    /**
     * Generate cache key for implementation plan
     */
    static planKey(fileKey: string, version?: string, filters?: Record<string, unknown>): string {
        const base = version ? `${fileKey}:${version}:plan` : `${fileKey}:latest:plan`;
        if (filters && Object.keys(filters).length > 0) {
            const filterStr = Object.entries(filters)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
            return `${base}:${filterStr}`;
        }
        return base;
    }
}
