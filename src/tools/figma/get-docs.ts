/**
 * Get Documentation Tool
 * Returns the usage instructions for this MCP server
 */

import { Tool } from '../../types/mcp.js';

/**
 * MCP Tool Definition
 */
export const getDocumentationTool: Tool = {
    name: 'getDocumentation',
    description:
        'Get the comprehensive usage instructions, rules, and best practices for using this Figma MCP server. Call this tool first if you are unsure how to interpret Figma data or structure your implementation plans.',
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
};
