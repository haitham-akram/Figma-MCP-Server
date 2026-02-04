/**
 * Get Component Styles Tool Definition
 * Extracts detailed styling information for components/frames including colors, fonts, images, and effects
 */

import { Tool } from '../../types/mcp.js';

export interface GetComponentStylesInput {
    fileKey: string;
    componentId: string;
    version?: string;
    includeChildren?: boolean;
}

export const GET_COMPONENT_STYLES_TOOL: Tool = {
    name: 'getComponentStyles',
    description: 'Get detailed styling information for a specific component or frame including colors, typography, images, icons, effects, and all visual properties. Use this to understand exactly how a component should look.',
    inputSchema: {
        type: 'object',
        properties: {
            fileKey: {
                type: 'string',
                description: 'Figma file key from URL (e.g., "abc123xyz")',
            },
            componentId: {
                type: 'string',
                description: 'ID of the component or frame to extract styles from',
            },
            version: {
                type: 'string',
                description: 'Optional: specific file version ID to query',
            },
            includeChildren: {
                type: 'boolean',
                description: 'Whether to include detailed styles for all child elements (default: true)',
                default: true,
            },
        },
        required: ['fileKey', 'componentId'],
    },
};
