/**
 * Server Configuration
 * Validates and exports environment variables
 */

interface Config {
    PORT: number;
    HOST: string;
    LOG_LEVEL: string;
}

/**
 * Parse and validate PORT environment variable
 */
function validatePort(portStr: string | undefined, defaultPort: number): number {
    const port = parseInt(portStr || String(defaultPort), 10);

    if (isNaN(port)) {
        throw new Error(`Invalid PORT: "${portStr}" is not a valid number`);
    }

    if (port < 1 || port > 65535) {
        throw new Error(`Invalid PORT: ${port} must be between 1 and 65535`);
    }

    return port;
}

/**
 * Validate HOST environment variable
 */
function validateHost(host: string | undefined, defaultHost: string): string {
    const validHost = host || defaultHost;

    if (!validHost || validHost.trim().length === 0) {
        throw new Error('Invalid HOST: must be a non-empty string');
    }

    return validHost;
}

/**
 * Validate LOG_LEVEL environment variable
 */
function validateLogLevel(level: string | undefined, defaultLevel: string): string {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const logLevel = level || defaultLevel;

    if (!validLevels.includes(logLevel)) {
        throw new Error(
            `Invalid LOG_LEVEL: "${logLevel}" must be one of: ${validLevels.join(', ')}`
        );
    }

    return logLevel;
}

/**
 * Load and validate configuration
 */
function loadConfig(): Config {
    try {
        const PORT = validatePort(process.env.PORT, 5000);
        const HOST = validateHost(process.env.HOST, '127.0.0.1');
        const LOG_LEVEL = validateLogLevel(process.env.LOG_LEVEL, 'info');

        return {
            PORT,
            HOST,
            LOG_LEVEL,
        };
    } catch (error) {
        console.error('Configuration Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

export const config = loadConfig();
