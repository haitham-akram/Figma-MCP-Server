# MCP Server

A minimal, production-ready MCP (Model Context Protocol) compatible server built with Node.js, TypeScript, and Fastify. This server implements JSON-RPC 2.0 protocol with tool discovery and execution capabilities.

## Features

- ✅ **JSON-RPC 2.0 compliant** - All endpoints follow JSON-RPC 2.0 specification
- ✅ **Fastify-powered** - High-performance HTTP server with built-in validation
- ✅ **TypeScript** - Full type safety with strict mode enabled
- ✅ **Pre-compiled schemas** - AJV schema validation compiled at startup for optimal performance
- ✅ **Fail-fast validation** - Environment variables and tool schemas validated on startup
- ✅ **Graceful shutdown** - Handles SIGTERM and SIGINT signals properly
- ✅ **Production-ready** - Structured logging, error handling, and health checks

## Environment Variables

| Variable    | Default     | Description                                                        |
| ----------- | ----------- | ------------------------------------------------------------------ |
| `PORT`      | `3000`      | Server port (1-65535)                                              |
| `HOST`      | `127.0.0.1` | Server host address (use `0.0.0.0` for all interfaces)             |
| `LOG_LEVEL` | `info`      | Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |

## Installation

1. **Clone or copy the repository**

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to customize settings if needed.

## Usage

### Development

Run the server with hot-reload:

```bash
npm run dev
```

The server will automatically restart when you make changes to the source code.

### Production

1. **Build the TypeScript code:**

   ```bash
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

## API Endpoints

### Health Check

**GET** `/health`

Returns server health status (non-JSON-RPC endpoint for monitoring).

**Response:**

```json
{
  "status": "ok"
}
```

### JSON-RPC Endpoint

**POST** `/rpc`

All MCP protocol methods are accessed through this endpoint using JSON-RPC 2.0 format.

#### Get Manifest

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "manifest",
  "id": 1
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "name": "mcp-server",
    "version": "1.0.0",
    "description": "Minimal MCP-compatible server using Fastify and TypeScript",
    "capabilities": {
      "tools": {}
    }
  },
  "id": 1
}
```

#### List Tools

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": []
  },
  "id": 2
}
```

#### Call Tool

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "params": {
      "param1": "value1"
    }
  },
  "id": 3
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool result here"
      }
    ]
  },
  "id": 3
}
```

#### Error Response

When an error occurs, the server returns a JSON-RPC 2.0 error:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "availableMethods": ["manifest", "tools/list", "tools/call"]
    }
  },
  "id": 1
}
```

**Error Codes:**

- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

## Project Structure

```
figma_mcp_server/
├── src/
│   ├── index.ts              # Entry point, server startup
│   ├── server.ts             # Fastify server setup and routes
│   ├── config.ts             # Environment variable validation
│   ├── types/
│   │   └── mcp.ts            # TypeScript type definitions
│   ├── utils/
│   │   └── jsonrpc.ts        # JSON-RPC helper functions
│   └── tools/
│       ├── definitions.ts    # Tool metadata and schemas
│       └── registry.ts       # Tool management and execution
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example              # Example environment variables
├── .gitignore
└── README.md
```

## Adding New Tools

To add a new tool:

1. **Define the tool in `src/tools/definitions.ts`:**

   ```typescript
   export const TOOL_DEFINITIONS: Tool[] = [
     {
       name: 'my_tool',
       description: 'Description of what the tool does',
       inputSchema: {
         type: 'object',
         properties: {
           param1: {
             type: 'string',
             description: 'First parameter',
           },
         },
         required: ['param1'],
         additionalProperties: false,
       },
     },
   ]
   ```

2. **Implement the tool logic in `src/tools/registry.ts`:**

   ```typescript
   export async function executeTool(name: string, params?: Record<string, unknown>): Promise<ToolCallResult> {
     const tool = getToolByName(name)

     if (!tool) {
       throw {
         code: ErrorCodes.METHOD_NOT_FOUND,
         message: `Tool "${name}" not found`,
       }
     }

     // Add your tool implementation here
     switch (name) {
       case 'my_tool':
         return {
           content: [
             {
               type: 'text',
               text: `Result: ${params?.param1}`,
             },
           ],
         }

       default:
         throw {
           code: ErrorCodes.METHOD_NOT_FOUND,
           message: `Tool "${name}" not implemented`,
         }
     }
   }
   ```

3. **Restart the server** - schemas are compiled at startup

## License

ISC
