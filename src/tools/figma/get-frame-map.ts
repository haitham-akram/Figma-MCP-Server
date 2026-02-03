/**
 * Get Frame Map Tool
 * Returns a flattened map of all frames in a Figma file with hierarchy
 */

import { Tool } from '../../types/mcp.js';

/**
 * Tool input parameters
 */
export interface GetFrameMapInput {
    /** Figma file key (found in file URL) */
    fileKey: string;
    /** Optional: Specific version ID to query historical state */
    version?: string;
    /** Optional: Filter frames by name (partial match) */
    frameName?: string;
    /**
     * Optional: Maximum number of frames to return
     * @default 100
     */
    limit?: number;
    /**
     * Optional: Number of frames to skip
     * @default 0
     */
    offset?: number;
}

/**
 * MCP Tool Definition
 */
export const getFrameMapTool: Tool = {
    name: 'getFrameMap',
    description:
        'Get a flattened map of all frames in a Figma file. Use this when designers are working with frames instead of components. IMPORTANT: Follow formatting rules in getDocumentation tool output for your response.',
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
            frameName: {
                type: 'string',
                description:
                    'Optional: Filter frames by name (partial match, case-insensitive)',
            },
            limit: {
                type: 'number',
                description: 'Optional: Maximum number of frames to return (default: 100)',
                minimum: 1,
                maximum: 1000,
            },
            offset: {
                type: 'number',
                description: 'Optional: Number of frames to skip for pagination (default: 0)',
                minimum: 0,
            },
        },
        required: ['fileKey'],
        additionalProperties: true,
    },
};
