/**
 * MCP Server Entry Point
 */

import { config } from './config.js';
import { createServer } from './server.js';

/**
 * Start the server
 */
async function start(): Promise<void> {
    let server;

    try {
        // Create server instance
        server = createServer(config.LOG_LEVEL);

        // Start listening
        await server.listen({
            port: config.PORT,
            host: config.HOST,
        });

        server.log.info(
            `MCP Server started successfully on http://${config.HOST}:${config.PORT}`
        );
        server.log.info(`Health check: http://${config.HOST}:${config.PORT}/health`);
        server.log.info(`JSON-RPC endpoint: http://${config.HOST}:${config.PORT}/rpc`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
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

// Start the server
start();
