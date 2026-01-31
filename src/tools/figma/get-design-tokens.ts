/**
 * Get Design Tokens Tool
 * Returns design tokens in an LLM-optimized structure
 */

import { Tool } from '../../types/mcp.js';
import { DesignTokensResponse, TokenCategory } from '../../types/figma.js';
import { FigmaError } from '../../types/figma-base.js';

/**
 * Tool input parameters
 */
export interface GetDesignTokensInput {
    /** Figma file key (found in file URL) */
    fileKey: string;
    /** Optional: Specific version ID to query historical state */
    version?: string;
    /** Optional: Filter tokens by category */
    tokenType?: TokenCategory;
    /** Optional: Filter tokens by name (partial match) */
    tokenName?: string;
    /**
     * Optional: Maximum number of tokens to return
     * @default 100
     */
    limit?: number;
    /**
     * Optional: Number of tokens to skip
     * @default 0
     */
    offset?: number;
}

/**
 * Tool response type
 */
export type GetDesignTokensResponse = DesignTokensResponse;

/**
 * Tool error types
 */
export type GetDesignTokensError = FigmaError;

/**
 * MCP Tool Definition
 */
export const getDesignTokensTool: Tool = {
    name: 'getDesignTokens',
    description:
        'Extract design tokens (colors, typography, spacing, shadows, etc.) from a Figma file in an LLM-optimized format. Tokens are organized by category with clear names, values, descriptions, and usage guidance. Loosely aligned with Style Dictionary format but optimized for LLM consumption.',
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
            tokenType: {
                type: 'string',
                enum: ['color', 'typography', 'spacing', 'borderRadius', 'shadow', 'opacity', 'other'],
                description: 'Optional: Filter tokens by category',
            },
            tokenName: {
                type: 'string',
                description: 'Optional: Filter tokens by name (partial match, case-insensitive)',
            },
            limit: {
                type: 'number',
                description: 'Optional: Maximum number of tokens to return (default: 100)',
                minimum: 1,
                maximum: 1000,
            },
            offset: {
                type: 'number',
                description: 'Optional: Number of tokens to skip for pagination (default: 0)',
                minimum: 0,
            },
        },
        required: ['fileKey'],
        additionalProperties: false,
    },
};
