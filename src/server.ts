/**
 * Fastify Server Setup
 * Configures routes and middleware for MCP protocol
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    JSONRPCRequest,
    Manifest,
    ErrorCodes,
    ToolCallRequest,
} from './types/mcp.js';
import {
    createSuccessResponse,
    createErrorResponse,
    validateJsonRpcRequest,
} from './utils/jsonrpc.js';
import {
    getTools,
    getToolByName,
    getValidator,
    initializeSchemas,
    initializeFigmaClient,
    executeTool,
} from './tools/registry.js';

/**
 * Create and configure Fastify server
 */
export function createServer(logLevel: string): FastifyInstance {
    const fastify = Fastify({
        logger: {
            level: logLevel,
        },
    });

    // Load package.json for server metadata
    const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    // Initialize Figma client (must happen before schema initialization)
    try {
        initializeFigmaClient();
        fastify.log.info('Figma client initialized');
    } catch (error) {
        fastify.log.error('Failed to initialize Figma client');
        throw error;
    }

    // Initialize and pre-compile tool schemas (fail fast on invalid schemas)
    try {
        initializeSchemas(fastify);
    } catch (error) {
        fastify.log.error('Failed to initialize tool schemas');
        throw error;
    }

    /**
     * Health check endpoint (non-JSON-RPC)
     */
    fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
        return { status: 'ok' };
    });

    /**
     * Main JSON-RPC endpoint
     */
    fastify.post('/rpc', async (request: FastifyRequest, reply: FastifyReply) => {
        const requestId = (request.body as any)?.id ?? null;

        try {
            // Validate JSON-RPC request structure
            const validation = validateJsonRpcRequest(request.body);
            if (!validation.valid) {
                return createErrorResponse(
                    requestId,
                    ErrorCodes.INVALID_REQUEST,
                    'Invalid JSON-RPC request',
                    { errors: validation.errors }
                );
            }

            const rpcRequest = request.body as JSONRPCRequest;
            const { method, params, id } = rpcRequest;

            // Route to appropriate handler based on method
            switch (method) {
                case 'manifest':
                    return handleManifest(id, packageJson);

                case 'tools/list':
                    return handleToolsList(id);

                case 'tools/call':
                    return await handleToolsCall(id, params, fastify);

                default:
                    return createErrorResponse(
                        id,
                        ErrorCodes.METHOD_NOT_FOUND,
                        `Method "${method}" not found`,
                        {
                            availableMethods: ['manifest', 'tools/list', 'tools/call'],
                        }
                    );
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            fastify.log.error(`Error processing JSON-RPC request: ${errorMessage}`);

            // Check if it's a known JSON-RPC error
            if (error && typeof error === 'object' && 'code' in error) {
                return createErrorResponse(
                    requestId,
                    (error as any).code,
                    (error as any).message,
                    (error as any).data
                );
            }

            // Otherwise, return internal error
            return createErrorResponse(
                requestId,
                ErrorCodes.INTERNAL_ERROR,
                'Internal server error',
                {
                    message: errorMessage,
                }
            );
        }
    });

    return fastify;
}

/**
 * Handle 'manifest' method
 */
function handleManifest(
    id: string | number | null,
    packageJson: any
): ReturnType<typeof createSuccessResponse> {
    const manifest: Manifest = {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        capabilities: {
            tools: {},
        },
    };

    return createSuccessResponse(id, manifest);
}

/**
 * Handle 'tools/list' method
 */
function handleToolsList(
    id: string | number | null
): ReturnType<typeof createSuccessResponse> {
    const tools = getTools();
    return createSuccessResponse(id, { tools });
}

/**
 * Handle 'tools/call' method with parameter validation
 */
async function handleToolsCall(
    id: string | number | null,
    params: unknown,
    fastify: FastifyInstance
): Promise<ReturnType<typeof createSuccessResponse | typeof createErrorResponse>> {
    // Validate params structure
    if (!params || typeof params !== 'object') {
        return createErrorResponse(
            id,
            ErrorCodes.INVALID_PARAMS,
            'Invalid params: must be an object',
            { received: typeof params }
        );
    }

    const toolCall = params as ToolCallRequest;

    if (typeof toolCall.name !== 'string') {
        return createErrorResponse(
            id,
            ErrorCodes.INVALID_PARAMS,
            'Invalid params: "name" field must be a string',
            { received: typeof toolCall.name }
        );
    }

    // Get tool definition
    const tool = getToolByName(toolCall.name);
    if (!tool) {
        return createErrorResponse(
            id,
            ErrorCodes.METHOD_NOT_FOUND,
            `Tool "${toolCall.name}" not found`,
            { availableTools: getTools().map((t) => t.name) }
        );
    }

    // Validate tool params against schema using pre-compiled AJV validator
    const toolParams = toolCall.params || {};
    const validate = getValidator(tool.name);

    if (validate && !validate(toolParams)) {
        return createErrorResponse(
            id,
            ErrorCodes.INVALID_PARAMS,
            'Invalid tool parameters',
            {
                tool: tool.name,
                errors: validate.errors,
            }
        );
    }

    // Execute tool
    try {
        const result = await executeTool(tool.name, toolParams);
        return createSuccessResponse(id, result);
    } catch (error) {
        // Check if it's a known JSON-RPC error
        if (error && typeof error === 'object' && 'code' in error) {
            return createErrorResponse(
                id,
                (error as any).code,
                (error as any).message,
                (error as any).data
            );
        }

        throw error; // Re-throw to be caught by outer handler
    }
}
