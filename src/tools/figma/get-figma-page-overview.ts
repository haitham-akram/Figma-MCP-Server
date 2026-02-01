/**
 * Get Figma Page Overview Tool
 * Returns high-level information about pages in a Figma file
 */

import { Tool } from '../../types/mcp.js';
import { PageOverviewResponse } from '../../types/figma.js';
import { FigmaError } from '../../types/figma-base.js';

/**
 * Tool input parameters
 */
export interface GetFigmaPageOverviewInput {
    /** Figma file key (found in file URL) */
    fileKey: string;
    /** Optional: Specific version ID to query historical state */
    version?: string;
    /** Optional: Specific page ID to filter results */
    pageId?: string;
    /**
     * Optional: Maximum number of pages to return
     * @default 100
     */
    limit?: number;
    /**
     * Optional: Number of pages to skip
     * @default 0
     */
    offset?: number;
}

/**
 * Tool response type
 */
export type GetFigmaPageOverviewResponse = PageOverviewResponse;

/**
 * Tool error types
 */
export type GetFigmaPageOverviewError = FigmaError;

/**
 * MCP Tool Definition
 */
export const getFigmaPageOverviewTool: Tool = {
    name: 'getFigmaPageOverview',
    description:
        'Get a high-level overview of all pages in a Figma file, including page names, node counts, dimensions, and background colors. Useful for understanding file structure before diving into specific components or design tokens.',
    inputSchema: {
        type: 'object',
        properties: {
            fileKey: {
                type: 'string',
                description: 'Figma file key (found in file URL: figma.com/file/{fileKey}/...)',
            },
            version: {
                type: 'string',
                description:
                    'Optional: Specific version ID to query historical design state. Omit for latest version.',
            },
            pageId: {
                type: 'string',
                description: 'Optional: Specific page ID to filter results to a single page',
            },
            limit: {
                type: 'number',
                description: 'Optional: Maximum number of pages to return (default: 100)',
                minimum: 1,
                maximum: 1000,
            },
            offset: {
                type: 'number',
                description: 'Optional: Number of pages to skip for pagination (default: 0)',
                minimum: 0,
            },
        },
        required: ['fileKey'],
        additionalProperties: false,
    },
};
