/**
 * Tool Registry
 * Manages tool registration, schema compilation, and execution
 */

import { FastifyInstance } from 'fastify';
import Ajv, { ValidateFunction } from 'ajv';
import { Tool, ToolCallResult, ErrorCodes } from '../types/mcp.js';
import { TOOL_DEFINITIONS } from './definitions.js';

// Store compiled validators
const validators = new Map<string, ValidateFunction>();

/**
 * Get all available tools
 */
export function getTools(): Tool[] {
    return TOOL_DEFINITIONS;
}

/**
 * Get a specific tool by name
 */
export function getToolByName(name: string): Tool | undefined {
    return TOOL_DEFINITIONS.find((tool) => tool.name === name);
}

/**
 * Get compiled validator for a tool
 */
export function getValidator(toolName: string): ValidateFunction | undefined {
    return validators.get(toolName);
}

/**
 * Initialize and pre-compile all tool schemas with AJV validator
 * Fails fast if any schema is invalid
 */
export function initializeSchemas(fastify: FastifyInstance): void {
    fastify.log.info('Initializing tool schemas...');

    const ajv = new Ajv({ allErrors: true });

    for (const tool of TOOL_DEFINITIONS) {
        try {
            // Pre-compile schema using AJV
            const validate = ajv.compile(tool.inputSchema);
            validators.set(tool.name, validate);

            fastify.log.debug(`Schema compiled successfully for tool: ${tool.name}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            fastify.log.error(`Failed to compile schema for tool "${tool.name}": ${errorMessage}`);
            throw new Error(
                `Invalid schema for tool "${tool.name}": ${errorMessage}. Server cannot start with invalid tool schemas.`
            );
        }
    }

    fastify.log.info(`Successfully initialized ${TOOL_DEFINITIONS.length} tool schema(s)`);
}

/**
 * Execute a tool with validated parameters
 */
export async function executeTool(
    name: string,
    params?: Record<string, unknown>
): Promise<ToolCallResult> {
    const tool = getToolByName(name);

    if (!tool) {
        throw {
            code: ErrorCodes.METHOD_NOT_FOUND,
            message: `Tool "${name}" not found`,
            data: {
                availableTools: TOOL_DEFINITIONS.map((t) => t.name),
            },
        };
    }

    // Tool implementation would go here
    // For minimal server, we just return a success response
    return {
        content: [
            {
                type: 'text',
                text: `Tool "${name}" executed successfully (no implementation yet)`,
            },
        ],
    };
}
