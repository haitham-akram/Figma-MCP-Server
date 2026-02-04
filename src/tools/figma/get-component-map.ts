/**
 * Get Component Map Tool
 * Returns a flattened map of all components in a Figma file with parent references
 */

import { Tool } from '../../types/mcp.js';
import { ComponentMapResponse } from '../../types/figma.js';
import { FigmaError } from '../../types/figma-base.js';

/**
 * Tool input parameters
 */
export interface GetComponentMapInput {
    /** Figma file key (found in file URL) */
    fileKey: string;
    /** Optional: Specific version ID to query historical state */
    version?: string;
    /** Optional: Filter components by name (partial match) */
    componentName?: string;
    /** Optional: Filter by component type */
    componentType?: 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE';
    /**
     * Optional: Maximum number of components to return
     * @default 100
     */
    limit?: number;
    /**
     * Optional: Number of components to skip
     * @default 0
     */
    offset?: number;
}

/**
 * Tool response type
 */
export type GetComponentMapResponse = ComponentMapResponse;

/**
 * Tool error types
 */
export type GetComponentMapError = FigmaError;

/**
 * MCP Tool Definition
 */
export const getComponentMapTool: Tool = {
    name: 'getComponentMap',
    description:
        'Get a flattened map of all components in a Figma file. IMPORTANT: Follow formatting rules in getDocumentation tool output for your response.',
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
            componentName: {
                type: 'string',
                description:
                    'Optional: Filter components by name (partial match, case-insensitive)',
            },
            componentType: {
                type: 'string',
                enum: ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'],
                description: 'Optional: Filter by component type',
            },
            limit: {
                type: 'number',
                description: 'Optional: Maximum number of components to return (default: 100)',
                minimum: 1,
                maximum: 1000,
            },
            offset: {
                type: 'number',
                description: 'Optional: Number of components to skip for pagination (default: 0)',
                minimum: 0,
            },
        },
        required: ['fileKey'],
        additionalProperties: true,
    },
};
