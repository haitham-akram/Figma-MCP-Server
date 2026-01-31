/**
 * Tool Definitions
 * Contains metadata and input schemas for all available tools
 */

import { Tool } from '../types/mcp.js';
import { getFigmaPageOverviewTool } from './figma/get-figma-page-overview.js';
import { getComponentMapTool } from './figma/get-component-map.js';
import { getDesignTokensTool } from './figma/get-design-tokens.js';
import { getImplementationPlanTool } from './figma/get-implementation-plan.js';

/**
 * All available tool definitions
 * Figma MCP tools for exposing design data to LLMs
 */
export const TOOL_DEFINITIONS: Tool[] = [
    getFigmaPageOverviewTool,
    getComponentMapTool,
    getDesignTokensTool,
    getImplementationPlanTool,
];
