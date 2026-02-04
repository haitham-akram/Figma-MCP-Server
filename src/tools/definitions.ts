/**
 * Tool Definitions
 * Contains metadata and input schemas for all available tools
 */

import { Tool } from '../types/mcp.js';
import { getFigmaPageOverviewTool } from './figma/get-figma-page-overview.js';
import { getComponentMapTool } from './figma/get-component-map.js';
import { getFrameMapTool } from './figma/get-frame-map.js';
import { getDesignTokensTool } from './figma/get-design-tokens.js';
import { getImplementationPlanTool } from './figma/get-implementation-plan.js';
import { getDocumentationTool } from './figma/get-docs.js';
import { GET_COMPONENT_STYLES_TOOL } from './figma/get-component-styles.js';

/**
 * All available tool definitions
 * Figma MCP tools for exposing design data to LLMs
 */
export const TOOL_DEFINITIONS: Tool[] = [
    getDocumentationTool,
    getFigmaPageOverviewTool,
    getFrameMapTool,
    getComponentMapTool,
    getDesignTokensTool,
    getImplementationPlanTool,
    GET_COMPONENT_STYLES_TOOL,
];
