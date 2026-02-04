/**
 * MCP Server Entry Point
 */

import { config } from './config.js';
import { createServer, handleRequest } from './server.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { FastifyInstance } from 'fastify';

// In CommonJS, __dirname is already available.
const currentDirname = __dirname;

const packageJson = JSON.parse(
    readFileSync(join(currentDirname, '..', 'package.json'), 'utf-8')
);

/**
 * Start the server
 */
async function start(): Promise<void> {
    let server: FastifyInstance | undefined;

    try {
        // Create server instance
        server = createServer(config.LOG_LEVEL);

        // Start listening to HTTP if configured
        const port = config.PORT;
        await server.listen({
            port: port,
            host: config.HOST,
        });

        server.log.info(
            `MCP Server started successfully on http://${config.HOST}:${config.PORT}`
        );

        // Start listening to stdio for MCP protocol (VS Code, etc.)
        startStdio(server);
    } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
            console.error(
                `Port ${config.PORT} is already in use. Please close the other process or use a different port.`
            );
            // Fallback to stdio ONLY if port is in use (allows it to still work in VS Code as a tool)
            try {
                const dummyServer = createServer(config.LOG_LEVEL);
                startStdio(dummyServer);
                console.error('Started in stdio-only mode.');
            } catch (innerError) {
                process.exit(1);
            }
        } else {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
        if (server) {
            server.log.info(`Received ${signal}, closing server gracefully...`);
            await server.close();
            server.log.info('Server closed');
        }
        process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Handle MCP protocol via stdio (stdin/stdout)
 */
function startStdio(server: FastifyInstance): void {
    const rl = readline.createInterface({
        input: process.stdin,
        terminal: false,
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const request = JSON.parse(line);
            const response = await handleRequest(request, packageJson, server);

            if (response !== null) {
                process.stdout.write(JSON.stringify(response) + '\n');
            }
        } catch (error) {
            console.error('Error handling stdio request:', error);
        }
    });

    console.error('MCP stdio listener started');
}

// Start the server
start();
