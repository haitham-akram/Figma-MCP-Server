/**
 * Tool Registry
 * Manages tool registration, schema compilation, and execution
 */

import { FastifyInstance } from 'fastify';
import Ajv, { ValidateFunction } from 'ajv';
import { Tool, ToolCallResult, ErrorCodes } from '../types/mcp.js';
import { TOOL_DEFINITIONS } from './definitions.js';
import { FigmaClient, FigmaApiError } from '../clients/figma-client.js';
import { handleGetFigmaPageOverview } from './handlers/get-figma-page-overview-handler.js';
import { handleGetComponentMap } from './handlers/get-component-map-handler.js';
import { handleGetFrameMap } from './handlers/get-frame-map-handler.js';
import { handleGetDesignTokens } from './handlers/get-design-tokens-handler.js';
import { handleGetImplementationPlan } from './handlers/get-implementation-plan-handler.js';
import { getDocumentationHandler } from './handlers/get-docs-handler.js';
import { config, CACHE_CONFIG } from '../config.js';
import { CacheManager } from '../cache/cache-manager.js';

// Store compiled validators
const validators = new Map<string, ValidateFunction>();

// Figma client instance (initialized in server.ts)
let figmaClient: FigmaClient | null = null;

// Cache manager instance
let cacheManager: CacheManager | null = null;

/**
 * Initialize Figma client with cache manager
 * Called from server.ts during startup
 */
export function initializeFigmaClient(): void {
    if (!config.FIGMA_ACCESS_TOKEN) {
        throw new Error(
            'FIGMA_ACCESS_TOKEN is required. Please set it in your .env file or environment variables.'
        );
    }

    // Initialize cache manager
    cacheManager = new CacheManager(CACHE_CONFIG);

    // Initialize Figma client with caching
    figmaClient = new FigmaClient(
        {
            accessToken: config.FIGMA_ACCESS_TOKEN,
        },
        undefined, // Use default HTTP client
        cacheManager
    );

    console.error('Figma client initialized successfully');
    console.error(`Cache: ${CACHE_CONFIG.enabled ? 'ENABLED' : 'DISABLED'} (max size: ${CACHE_CONFIG.maxSize}, default TTL: ${CACHE_CONFIG.defaultTTL}s)`);
}

/**
 * Get cache manager instance
 */
export function getCacheManager(): CacheManager | null {
    return cacheManager;
}

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

    if (!figmaClient) {
        throw {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Figma client not initialized',
        };
    }

    try {
        // Dispatch to appropriate handler
        let result: any;

        switch (name) {
            case 'getDocumentation':
                result = await getDocumentationHandler();
                break;

            case 'getFigmaPageOverview':
                result = await handleGetFigmaPageOverview(params as any, figmaClient);
                break;

            case 'getComponentMap':
                result = await handleGetComponentMap(params as any, figmaClient);
                break;

            case 'getFrameMap':
                result = await handleGetFrameMap(params as any, figmaClient);
                break;

            case 'getDesignTokens':
                result = await handleGetDesignTokens(params as any, figmaClient);
                break;

            case 'getImplementationPlan':
                result = await handleGetImplementationPlan(params as any, figmaClient);
                break;

            default:
                throw {
                    code: ErrorCodes.METHOD_NOT_FOUND,
                    message: `Handler not implemented for tool "${name}"`,
                };
        }

        // Return result as MCP ToolCallResult
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        // Translate errors to JSON-RPC format
        if (error instanceof FigmaApiError) {
            // Map Figma API errors to JSON-RPC error codes
            let code: number;
            let message: string;

            switch (error.status) {
                case 401:
                    code = -32001; // Unauthorized
                    message = 'Unauthorized: Invalid or missing Figma access token';
                    break;

                case 404:
                    code = -32002; // Not found
                    message = 'Not found: Figma file or resource does not exist';
                    break;

                case 429:
                    code = -32003; // Rate limit
                    message = 'Rate limit exceeded: Too many requests to Figma API';
                    break;

                default:
                    code = -32000; // Generic server error
                    message = `Figma API error: ${error.message}`;
            }

            // Log full error details server-side for debugging
            console.error('[Figma API Error]', {
                status: error.status,
                statusText: error.statusText,
                response: error.response,
            });

            throw {
                code,
                message,
                data: {
                    status: error.status,
                    statusText: error.statusText,
                    // Omit raw response to prevent leaking sensitive Figma API details
                },
            };
        }

        // Re-throw other errors
        throw error;
    }
}
