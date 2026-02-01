/**
 * Figma API Client
 * Read-only client for Figma REST API
 * 
 * NO MCP or LLM knowledge - pure API wrapper
 * Easy to mock for testing via dependency injection
 */

import {
    FigmaFileResponse,
    FigmaFileNodesResponse,
    FigmaFileVersionsResponse,
    FigmaApiErrorResponse,
} from '../types/figma-api.js';
import { CacheManager } from '../cache/cache-manager.js';

/**
 * Figma API client configuration
 */
export interface FigmaClientConfig {
    accessToken: string;
    baseUrl?: string;
}

/**
 * Figma API error
 */
export class FigmaApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly response?: FigmaApiErrorResponse
    ) {
        super(`Figma API Error ${status}: ${statusText}${response ? ` - ${response.err}` : ''}`);
        this.name = 'FigmaApiError';
    }
}

/**
 * HTTP client interface for dependency injection and testing
 */
export interface HttpClient {
    fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Default HTTP client using Node.js fetch
 */
export class DefaultHttpClient implements HttpClient {
    async fetch(url: string, options?: RequestInit): Promise<Response> {
        return fetch(url, options);
    }
}

/**
 * Figma API Client
 * 
 * Usage:
 * ```typescript
 * const client = new FigmaClient({ accessToken: 'your-token' });
 * const file = await client.getFile('file-key');
 * ```
 * 
 * For testing:
 * ```typescript
 * const mockHttp = { fetch: vi.fn() };
 * const client = new FigmaClient({ accessToken: 'test' }, mockHttp);
 * ```
 */
export class FigmaClient {
    private readonly baseUrl: string;
    private readonly accessToken: string;
    private readonly httpClient: HttpClient;
    private readonly cacheManager: CacheManager | null;

    constructor(config: FigmaClientConfig, httpClient?: HttpClient, cacheManager?: CacheManager | null) {
        this.baseUrl = config.baseUrl || 'https://api.figma.com/v1';
        this.accessToken = config.accessToken;
        this.httpClient = httpClient || new DefaultHttpClient();
        this.cacheManager = cacheManager === undefined ? null : cacheManager;
    }

    /**
     * Make authenticated request to Figma API
     */
    private async request<T>(endpoint: string): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const response = await this.httpClient.fetch(url, {
                method: 'GET',
                headers: {
                    'X-Figma-Token': this.accessToken,
                },
            });

            if (!response.ok) {
                let errorResponse: FigmaApiErrorResponse | undefined;
                try {
                    errorResponse = await response.json() as FigmaApiErrorResponse;
                } catch {
                    // Ignore JSON parse errors
                }

                throw new FigmaApiError(response.status, response.statusText, errorResponse);
            }

            return await response.json() as T;
        } catch (error) {
            if (error instanceof FigmaApiError) {
                throw error;
            }

            // Network or other errors
            throw new Error(
                `Failed to fetch from Figma API: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get file metadata and full document tree
     * 
     * @param fileKey - Figma file key from URL
     * @param options - Optional query parameters
     * @returns File data with document tree
     * 
     * @example
     * ```typescript
     * const file = await client.getFile('abc123', { version: '1.0' });
     * console.log(file.name, file.document);
     * ```
     */
    async getFile(
        fileKey: string,
        options?: {
            version?: string;
            geometry?: 'paths';
            depth?: number;
        }
    ): Promise<FigmaFileResponse> {
        // Check cache first (only cache simple requests without geometry/depth filters)
        if (this.cacheManager && !options?.geometry && !options?.depth) {
            const cacheKey = CacheManager.fileKey(fileKey, options?.version);
            const cached = await this.cacheManager.get<FigmaFileResponse>(cacheKey);

            if (cached) {
                return cached;
            }
        }

        // Cache miss or caching disabled - fetch from API
        const params = new URLSearchParams();

        if (options?.version) {
            params.append('version', options.version);
        }
        if (options?.geometry) {
            params.append('geometry', options.geometry);
        }
        if (options?.depth !== undefined) {
            params.append('depth', String(options.depth));
        }

        const query = params.toString();
        const endpoint = `/files/${fileKey}${query ? `?${query}` : ''}`;

        const response = await this.request<FigmaFileResponse>(endpoint);

        // Cache the response (only for simple requests)
        if (this.cacheManager && !options?.geometry && !options?.depth) {
            const cacheKey = CacheManager.fileKey(fileKey, options?.version);
            await this.cacheManager.set(cacheKey, response, 'file');
        }

        return response;
    }

    /**
     * Get specific nodes from a file
     * 
     * @param fileKey - Figma file key from URL
     * @param nodeIds - Array of node IDs to fetch
     * @param options - Optional query parameters
     * @returns Nodes data
     * 
     * @example
     * ```typescript
     * const nodes = await client.getFileNodes('abc123', ['123:456', '789:012']);
     * console.log(nodes.nodes['123:456']);
     * ```
     */
    async getFileNodes(
        fileKey: string,
        nodeIds: string[],
        options?: {
            version?: string;
            geometry?: 'paths';
            depth?: number;
        }
    ): Promise<FigmaFileNodesResponse> {
        if (nodeIds.length === 0) {
            throw new Error('At least one node ID is required');
        }

        const params = new URLSearchParams();
        params.append('ids', nodeIds.join(','));

        if (options?.version) {
            params.append('version', options.version);
        }
        if (options?.geometry) {
            params.append('geometry', options.geometry);
        }
        if (options?.depth !== undefined) {
            params.append('depth', String(options.depth));
        }

        const endpoint = `/files/${fileKey}/nodes?${params.toString()}`;

        return this.request<FigmaFileNodesResponse>(endpoint);
    }

    /**
     * Get file version history
     * 
     * @param fileKey - Figma file key from URL
     * @returns Version history
     * 
     * @example
     * ```typescript
     * const versions = await client.getFileVersions('abc123');
     * console.log(versions.versions[0].id);
     * ```
     */
    async getFileVersions(fileKey: string): Promise<FigmaFileVersionsResponse> {
        const endpoint = `/files/${fileKey}/versions`;
        return this.request<FigmaFileVersionsResponse>(endpoint);
    }
}
