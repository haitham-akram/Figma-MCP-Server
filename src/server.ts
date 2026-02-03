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
            stream: process.stderr, // Redirect Fastify logs to stderr
        },
    });

    // Load package.json for server metadata (using absolute path for VS Code environment)
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

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
        const response = await handleRequest(request.body, packageJson, fastify);
        if (response === null) {
            reply.status(204).send();
            return;
        }
        return response;
    });

    return fastify;
}

/**
 * Shared JSON-RPC request handler
 */
export async function handleRequest(
    body: any,
    packageJson: any,
    fastify: FastifyInstance
): Promise<any> {
    const requestId = body?.id ?? null;

    try {
        // Validate JSON-RPC request structure
        const validation = validateJsonRpcRequest(body);
        if (!validation.valid) {
            return createErrorResponse(
                requestId,
                ErrorCodes.INVALID_REQUEST,
                'Invalid JSON-RPC request',
                { errors: validation.errors }
            );
        }

        const rpcRequest = body as JSONRPCRequest;
        const { method, params, id } = rpcRequest;

        // Route to appropriate handler based on method
        switch (method) {
            case 'initialize':
                return createSuccessResponse(id, {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        resources: {},
                    },
                    serverInfo: {
                        name: packageJson.name,
                        version: packageJson.version,
                    },
                });

            case 'notifications/initialized':
                return null; // MCP notifications don't get responses

            case 'manifest':
                return handleManifest(id, packageJson);

            case 'tools/list':
                return handleToolsList(id);

            case 'tools/call':
                return await handleToolsCall(id, params, fastify);

            case 'resources/list':
                return handleResourcesList(id);

            case 'resources/read':
                return handleResourcesRead(id, params);

            default:
                return createErrorResponse(
                    id,
                    ErrorCodes.METHOD_NOT_FOUND,
                    `Method "${method}" not found`,
                    {
                        availableMethods: [
                            'initialize',
                            'manifest',
                            'tools/list',
                            'tools/call',
                            'resources/list',
                            'resources/read',
                        ],
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
            resources: {},
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
    const toolParams = toolCall.arguments || {};
    const validate = getValidator(tool.name);

    if (validate && !validate(toolParams)) {
        fastify.log.error(
            { tool: tool.name, errors: validate.errors, arguments: toolParams },
            'Tool parameter validation failed'
        );
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

/**
 * Handle 'resources/list' method
 */
function handleResourcesList(id: string | number | null): any {
    return createSuccessResponse(id, {
        resources: [
            {
                uri: 'figma://instructions',
                name: 'Figma MCP Usage Instructions',
                description: 'Usage guidelines and rules for the Figma MCP server',
                mimeType: 'text/markdown',
            },
        ],
    });
}

/**
 * Handle 'resources/read' method
 */
function handleResourcesRead(id: string | number | null, params: any): any {
    const { uri } = params;
    if (uri === 'figma://instructions') {
        const content = readFileSync(join(__dirname, '..', 'COPILOT_INSTRUCTIONS.md'), 'utf-8');
        return createSuccessResponse(id, {
            contents: [
                {
                    uri,
                    mimeType: 'text/markdown',
                    text: content,
                },
            ],
        });
    }
    return createErrorResponse(id, ErrorCodes.INVALID_PARAMS, `Resource ${uri} not found`);
}
