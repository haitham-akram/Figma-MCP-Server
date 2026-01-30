/**
 * MCP (Model Context Protocol) Type Definitions
 * JSON-RPC 2.0 compliant types
 */

// JSON-RPC 2.0 Error Codes
export const ErrorCodes = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
} as const;

// JSON-RPC 2.0 Request
export interface JSONRPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
    id: string | number | null;
}

// JSON-RPC 2.0 Error Object
export interface JSONRPCError {
    code: number;
    message: string;
    data?: unknown;
}

// JSON-RPC 2.0 Response
export interface JSONRPCResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: JSONRPCError;
    id: string | number | null;
}

// Tool Input Schema (JSON Schema Draft 7)
export interface ToolInputSchema {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
}

// MCP Tool Definition
export interface Tool {
    name: string;
    description: string;
    inputSchema: ToolInputSchema;
}

// MCP Server Manifest
export interface Manifest {
    name: string;
    version: string;
    description?: string;
    capabilities: {
        tools?: Record<string, unknown>;
        resources?: Record<string, unknown>;
    };
}

// Tool Call Request
export interface ToolCallRequest {
    name: string;
    params?: Record<string, unknown>;
}

// Tool Call Result
export interface ToolCallResult {
    content: Array<{
        type: string;
        text: string;
    }>;
}
