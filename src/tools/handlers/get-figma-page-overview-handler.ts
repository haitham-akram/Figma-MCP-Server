/**
 * Get Figma Page Overview Handler
 * Fetches file data and returns high-level page information
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetFigmaPageOverviewInput } from '../figma/get-figma-page-overview.js';
import { PageOverviewResponse, PageSummary } from '../../types/figma.js';
import { CanvasNode } from '../../types/figma-api.js';

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

    // Apply pagination
    const paginatedPages = filteredPages.slice(offset, offset + limit);

    // Map to PageSummary format
    const pages: PageSummary[] = paginatedPages.map((page) => {
        const nodeCount = page.children?.length || 0;
        // CanvasNode doesn't have absoluteBoundingBox, calculate from children or use defaults
        const dimensions = { width: 0, height: 0 };

        return {
            id: page.id,
            name: page.name,
            nodeCount,
            dimensions,
            backgroundColor: page.backgroundColor,
        };
    });

    return {
        pages,
        totalCount,
        hasMore: offset + pages.length < totalCount,
    };
}
