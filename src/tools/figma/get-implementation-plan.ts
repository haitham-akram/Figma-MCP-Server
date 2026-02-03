/**
 * Get Implementation Plan Tool
 * Returns step-by-step implementation guidance and component-to-code mappings
 */

import { Tool } from '../../types/mcp.js';
import { ImplementationPlanResponse } from '../../types/figma.js';
import { FigmaError } from '../../types/figma-base.js';

/**
 * Tool input parameters
 */
export interface GetImplementationPlanInput {
    /** Figma file key (found in file URL) */
    fileKey: string;
    /** Optional: Specific version ID to query historical state */
    version?: string;
    /** Optional: Target framework for implementation guidance */
    targetFramework?: string;
    /** Optional: Specific page ID to generate plan for */
    pageId?: string;
    /** Optional: Specific component IDs to include in plan */
    componentIds?: string[];
}

/**
 * Tool response type
 */
export type GetImplementationPlanResponse = ImplementationPlanResponse;

/**
 * Tool error types
 */
export type GetImplementationPlanError = FigmaError;

/**
 * MCP Tool Definition
 */
export const getImplementationPlanTool: Tool = {
    name: 'getImplementationPlan',
    description:
        'Generate a comprehensive implementation plan for converting Figma designs to code. IMPORTANT: Follow formatting rules in getDocumentation tool output for your response.',
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
            targetFramework: {
                type: 'string',
                description:
                    'Optional: Target framework for implementation guidance (e.g., "React", "Vue", "Angular", "HTML/CSS"). Provides framework-specific code examples and naming conventions.',
            },
            pageId: {
                type: 'string',
                description:
                    'Optional: Specific page ID to generate implementation plan for. Omit to generate plan for entire file.',
            },
            componentIds: {
                type: 'array',
                items: {
                    type: 'string',
                },
                description:
                    'Optional: Array of specific component IDs to include in plan. Omit to include all components.',
            },
        },
        required: ['fileKey'],
        additionalProperties: true,
    },
};
