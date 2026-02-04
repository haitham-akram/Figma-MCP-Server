/**
 * Get Design Tokens Handler
 * Normalizes nodes and infers design token patterns
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetDesignTokensInput } from '../figma/get-design-tokens.js';
import { DesignTokensResponse, DesignToken } from '../../types/figma.js';
import { FigmaNode } from '../../types/figma-api.js';
import { NormalizedNode } from '../../types/normalized.js';
import { normalizeNode } from '../../mappers/node-mapper.js';
import { inferDesignTokens } from '../../mappers/token-mapper.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

/**
 * Maximum traversal depth for node normalization
 */
const MAX_TRAVERSAL_DEPTH = 12;

/**
 * Handle getDesignTokens tool execution
 * 
 * @param input - Tool input parameters
 * @param figmaClient - Figma API client instance
 * @returns Design tokens response with pagination
 */
export async function handleGetDesignTokens(
    input: GetDesignTokensInput,
    figmaClient: FigmaClient
): Promise<DesignTokensResponse> {
    const { fileKey, version, tokenType, tokenName, limit = 100, offset = 0 } = input;

    const cacheManager = getCacheManager();
    const cacheKey = CacheManager.tokensKey(fileKey, version);

    // Try to get processed tokens from cache
    let allTokens: DesignToken[] | null = null;
    if (cacheManager) {
        allTokens = await cacheManager.get<DesignToken[]>(cacheKey);
        if (allTokens) {
            console.error(`[Cache] Found processed tokens for ${fileKey}`);
        }
    }

    // If not in cache, fetch and process
    if (!allTokens) {
        // Fetch file data from Figma API
        const fileData = await figmaClient.getFile(fileKey, { version });

        // Traverse and normalize all nodes using BFS
        const normalizedNodes = traverseAndNormalize(fileData.document);

        console.error(`Normalized ${normalizedNodes.length} nodes for token inference`);

        // Infer design tokens from normalized nodes
        allTokens = inferDesignTokens(normalizedNodes);

        console.error(`Inferred ${allTokens.length} design tokens`);

        // Cache the processed tokens
        if (cacheManager) {
            await cacheManager.set(cacheKey, allTokens, 'tokens');
        }
    }

    // Apply filters
    let filteredTokens = allTokens;

    if (tokenType) {
        filteredTokens = filteredTokens.filter((token) => token.category === tokenType);
    }

    if (tokenName) {
        const lowerFilter = tokenName.toLowerCase();
        filteredTokens = filteredTokens.filter((token) =>
            token.name.toLowerCase().includes(lowerFilter)
        );
    }

    // Calculate exact total count
    const totalCount = filteredTokens.length;

    // Apply pagination
    const paginatedTokens = filteredTokens.slice(offset, offset + limit);

    return {
        tokens: paginatedTokens,
        totalCount,
        hasMore: offset + paginatedTokens.length < totalCount,
    };
}

/**
 * Traverse document tree and normalize nodes using BFS
 * 
 * @param root - Root node to start traversal
 * @returns Array of normalized nodes
 */
function traverseAndNormalize(root: FigmaNode): NormalizedNode[] {
    const normalizedNodes: NormalizedNode[] = [];
    const queue: Array<{ node: FigmaNode; depth: number; parentId?: string }> = [
        { node: root, depth: 0 },
    ];
    let maxDepthSeen = 0;

    while (queue.length > 0) {
        const { node, depth, parentId } = queue.shift()!;

        // Track max depth
        if (depth > maxDepthSeen) {
            maxDepthSeen = depth;
        }

        // Log warning if exceeding safe threshold
        if (depth === MAX_TRAVERSAL_DEPTH) {
            console.warn(
                `Normalization depth reached ${MAX_TRAVERSAL_DEPTH} levels at node "${node.name}" (${node.id}). Continuing traversal but performance may degrade.`
            );
        }

        // Normalize node
        const normalized = normalizeNode(node, parentId);
        if (normalized) {
            normalizedNodes.push(normalized);
        }

        // Enqueue children
        if ('children' in node && node.children) {
            for (const child of node.children) {
                queue.push({ node: child, depth: depth + 1, parentId: node.id });
            }
        }
    }

    console.error(
        `Node normalization complete: ${normalizedNodes.length} nodes normalized, max depth: ${maxDepthSeen}`
    );

    return normalizedNodes;
}
