/**
 * Server Configuration
 * Validates and exports environment variables
 */

import { CacheConfig } from './cache/types.js';

interface Config {
    PORT: number;
    HOST: string;
    LOG_LEVEL: string;
    FIGMA_ACCESS_TOKEN: string;
}

/**
 * Validate and parse a positive integer (> 0)
 */
function validatePositiveInt(
    value: string | undefined,
    defaultValue: number,
    varName: string
): number {
    const parsed = parseInt(value || String(defaultValue), 10);

    if (isNaN(parsed)) {
        throw new Error(
            `Invalid ${varName}: "${value}" is not a valid number. Using default: ${defaultValue}`
        );
    }

    if (parsed <= 0) {
        throw new Error(
            `Invalid ${varName}: ${parsed} must be a positive integer (> 0). Using default: ${defaultValue}`
        );
    }

    return parsed;
}

/**
 * Validate and parse a non-negative integer (>= 0)
 */
function validateNonNegativeInt(
    value: string | undefined,
    defaultValue: number,
    varName: string
): number {
    const parsed = parseInt(value || String(defaultValue), 10);

    if (isNaN(parsed)) {
        throw new Error(
            `Invalid ${varName}: "${value}" is not a valid number. Using default: ${defaultValue}`
        );
    }

    if (parsed < 0) {
        throw new Error(
            `Invalid ${varName}: ${parsed} must be a non-negative integer (>= 0). Using default: ${defaultValue}`
        );
    }

    return parsed;
}

/**
 * Cache configuration
 */
export const CACHE_CONFIG: CacheConfig = {
    enabled: process.env.CACHE_ENABLED !== 'false', // Enabled by default
    defaultTTL: validateNonNegativeInt(process.env.CACHE_DEFAULT_TTL, 300, 'CACHE_DEFAULT_TTL'), // 5 minutes
    maxSize: validatePositiveInt(process.env.CACHE_MAX_SIZE, 100, 'CACHE_MAX_SIZE'), // 100 entries
    ttlByType: {
        file: validateNonNegativeInt(process.env.CACHE_FILE_TTL, 600, 'CACHE_FILE_TTL'),       // 10 minutes
        components: validateNonNegativeInt(process.env.CACHE_COMPONENTS_TTL, 300, 'CACHE_COMPONENTS_TTL'), // 5 minutes
        tokens: validateNonNegativeInt(process.env.CACHE_TOKENS_TTL, 300, 'CACHE_TOKENS_TTL'),   // 5 minutes
        plan: validateNonNegativeInt(process.env.CACHE_PLAN_TTL, 180, 'CACHE_PLAN_TTL'),       // 3 minutes
    },
};

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
 * Validate FIGMA_ACCESS_TOKEN environment variable
 */
function validateFigmaToken(token: string | undefined): string {
    if (!token || token.trim().length === 0) {
        throw new Error(
            'Invalid FIGMA_ACCESS_TOKEN: must be set to a valid Figma Personal Access Token'
        );
    }

    return token.trim();
}

/**
 * Load and validate configuration
 */
function loadConfig(): Config {
    try {
        const PORT = validatePort(process.env.PORT, 5000);
        const HOST = validateHost(process.env.HOST, '127.0.0.1');
        const LOG_LEVEL = validateLogLevel(process.env.LOG_LEVEL, 'info');
        const FIGMA_ACCESS_TOKEN = validateFigmaToken(process.env.FIGMA_ACCESS_TOKEN);

        return {
            PORT,
            HOST,
            LOG_LEVEL,
            FIGMA_ACCESS_TOKEN,
        };
    } catch (error) {
        console.error('Configuration Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

export const config = loadConfig();
