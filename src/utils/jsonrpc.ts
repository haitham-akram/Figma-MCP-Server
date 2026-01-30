/**
 * JSON-RPC 2.0 Utility Functions
 */

import { JSONRPCResponse, JSONRPCError, ErrorCodes } from '../types/mcp.js';

/**
 * Create a JSON-RPC 2.0 success response
 */
export function createSuccessResponse(
    id: string | number | null,
    result: unknown
): JSONRPCResponse {
    return {
        jsonrpc: '2.0',
        result,
        id,
    };
}

/**
 * Create a JSON-RPC 2.0 error response
 */
export function createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
): JSONRPCResponse {
    const error: JSONRPCError = {
        code,
        message,
    };

    if (data !== undefined) {
        error.data = data;
    }

    return {
        jsonrpc: '2.0',
        error,
        id,
    };
}

/**
 * Validate JSON-RPC 2.0 request structure
 */
export function validateJsonRpcRequest(body: unknown): {
    valid: boolean;
    errors?: string[];
} {
    const errors: string[] = [];

    if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body must be an object'] };
    }

    const req = body as Record<string, unknown>;

    if (req.jsonrpc !== '2.0') {
        errors.push('jsonrpc field must be "2.0"');
    }

    if (typeof req.method !== 'string') {
        errors.push('method field must be a string');
    }

    if (!('id' in req) || (req.id !== null && typeof req.id !== 'string' && typeof req.id !== 'number')) {
        errors.push('id field must be a string, number, or null');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
}
