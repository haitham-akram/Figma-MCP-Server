/**
 * Figma Base Types
 * Contains primitive types, shared error types, and pagination utilities
 * for Figma MCP tool schemas
 */

/**
 * Figma file key identifier (e.g., "abc123xyz")
 * Found in Figma file URLs: figma.com/file/{fileKey}/...
 */
export type FigmaFileKey = string;

/**
 * Figma node identifier (e.g., "123:456")
 * Uniquely identifies elements within a Figma file
 */
export type NodeId = string;

/**
 * RGBA color representation with values 0-1
 * Standard format for all color values in Figma tool responses
 */
export interface RGBA {
    /** Red channel (0-1) */
    r: number;
    /** Green channel (0-1) */
    g: number;
    /** Blue channel (0-1) */
    b: number;
    /** Alpha channel (0-1) */
    a: number;
}

/**
 * Color type alias for RGBA
 */
export type Color = RGBA;

/**
 * Font weight values
 */
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/**
 * Text alignment options
 */
export type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';

/**
 * Figma node types
 */
export type NodeType =
    | 'DOCUMENT'
    | 'CANVAS'
    | 'FRAME'
    | 'GROUP'
    | 'VECTOR'
    | 'BOOLEAN_OPERATION'
    | 'STAR'
    | 'LINE'
    | 'ELLIPSE'
    | 'REGULAR_POLYGON'
    | 'RECTANGLE'
    | 'TEXT'
    | 'SLICE'
    | 'COMPONENT'
    | 'COMPONENT_SET'
    | 'INSTANCE';

/**
 * Pagination parameters for large datasets
 */
export interface PaginationParams {
    /**
     * Maximum number of items to return
     * @default 100
     */
    limit?: number;
    /**
     * Number of items to skip
     * @default 0
     */
    offset?: number;
}

/**
 * Pagination metadata included in responses
 */
export interface PaginationMetadata {
    /** Total number of items available */
    totalCount: number;
    /** Whether more items exist beyond current page */
    hasMore: boolean;
}

/**
 * Shared Figma API error types
 */

/**
 * Unauthorized access error
 * Thrown when Figma API token is invalid or missing
 */
export interface FigmaUnauthorizedError {
    type: 'unauthorized';
    message: string;
}

/**
 * Resource not found error
 * Thrown when file, node, or resource doesn't exist
 */
export interface FigmaNotFoundError {
    type: 'not_found';
    message: string;
    resource?: string;
}

/**
 * Rate limit exceeded error
 * Thrown when Figma API rate limit is exceeded
 */
export interface FigmaRateLimitError {
    type: 'rate_limit';
    message: string;
    retryAfter?: number;
}

/**
 * Union type of all Figma errors
 */
export type FigmaError = FigmaUnauthorizedError | FigmaNotFoundError | FigmaRateLimitError;

/**
 * Utility function type to convert RGBA to hex string
 * @param rgba - RGBA color object
 * @returns Hex color string (e.g., "#FF5733")
 */
export type RgbaToHex = (rgba: RGBA) => string;
