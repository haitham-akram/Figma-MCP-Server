/**
 * Get Figma Page Overview Handler
 * Fetches file data and returns high-level page information
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetFigmaPageOverviewInput } from '../figma/get-figma-page-overview.js';
import { PageOverviewResponse, PageSummary } from '../../types/figma.js';
import { CanvasNode } from '../../types/figma-api.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

/**
 * Handle getFigmaPageOverview tool execution
 * 
 * @param input - Tool input parameters
 * @param figmaClient - Figma API client instance
 * @returns Page overview response with pagination
 */
export async function handleGetFigmaPageOverview(
    input: GetFigmaPageOverviewInput,
    figmaClient: FigmaClient
): Promise<PageOverviewResponse> {
    const { fileKey, version, pageId, limit = 100, offset = 0 } = input;

    // Check cache for processed result
    const cacheManager = getCacheManager();
    const cacheKey = CacheManager.overviewKey(fileKey, version);
    if (cacheManager) {
        const cached = await cacheManager.get<PageSummary[]>(cacheKey);
        if (cached) {
            console.error(`[Cache] Found processed overview for ${fileKey}`);
            const paginatedPages = cached.slice(offset, offset + limit);
            return {
                pages: paginatedPages,
                totalCount: cached.length,
                hasMore: offset + paginatedPages.length < cached.length,
            };
        }
    }

    // Fetch file data from Figma API
    const fileData = await figmaClient.getFile(fileKey, { version });

    // Extract CANVAS nodes (pages) from document root
    const allPages = fileData.document.children?.filter(
        (node): node is CanvasNode => node.type === 'CANVAS'
    ) || [];

    // Apply pageId filter if specified
    const filteredPages = pageId
        ? allPages.filter((page) => page.id === pageId)
        : allPages;

    // Calculate estimated total count (before pagination)
    const totalCount = filteredPages.length;

    // Map all filtered pages to PageSummary format for caching
    const allSummaries: PageSummary[] = filteredPages.map((page) => {
        const nodeCount = page.children?.length || 0;
        const dimensions = { width: 0, height: 0 };

        return {
            id: page.id,
            name: page.name,
            nodeCount,
            dimensions,
            backgroundColor: page.backgroundColor,
        };
    });

    // Cache the full list of summaries
    if (cacheManager) {
        await cacheManager.set(cacheKey, allSummaries, 'overview');
    }

    // Apply pagination for the response
    const paginatedSummaries = allSummaries.slice(offset, offset + limit);

    return {
        pages: paginatedSummaries,
        totalCount: allSummaries.length,
        hasMore: offset + paginatedSummaries.length < allSummaries.length,
    };
}
