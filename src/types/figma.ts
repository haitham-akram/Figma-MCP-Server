/**
 * Figma Response Types
 * Contains LLM-friendly response interfaces for all Figma MCP tools
 */

import { NodeId, Color, FontWeight, TextAlign, NodeType, PaginationMetadata } from './figma-base.js';

/**
 * Page Overview Response
 * Returns high-level information about pages in a Figma file
 */

/**
 * Single page summary
 */
export interface PageSummary {
    /** Unique page node ID */
    id: NodeId;
    /** Page name */
    name: string;
    /** Number of top-level nodes in the page */
    nodeCount: number;
    /** Page dimensions */
    dimensions: {
        width: number;
        height: number;
    };
    /** Page background color */
    backgroundColor?: Color;
}

/**
 * Response for getFigmaPageOverview tool
 */
export interface PageOverviewResponse extends PaginationMetadata {
    /** Array of page summaries */
    pages: PageSummary[];
}

/**
 * Component Map Response
 * Returns flattened component hierarchy with parent references
 */

/**
 * Component variant property
 */
export interface ComponentVariant {
    /** Property name (e.g., "Size", "State") */
    propertyName: string;
    /** Property value (e.g., "Large", "Hover") */
    propertyValue: string;
}

/**
 * Single component in the map
 */
export interface ComponentInfo {
    /** Unique component node ID */
    id: NodeId;
    /** Component name */
    name: string;
    /** Component description from Figma */
    description?: string;
    /** Component type */
    type: 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE';
    /** Parent component ID (for nested components) */
    parentId?: NodeId;
    /** Array of child component IDs */
    childrenIds: NodeId[];
    /** Variant properties (for component variants) */
    variants?: ComponentVariant[];
    /** Component dimensions */
    dimensions: {
        width: number;
        height: number;
    };
}

/**
 * Response for getComponentMap tool
 */
export interface ComponentMapResponse extends PaginationMetadata {
    /** Array of flattened components */
    components: ComponentInfo[];
}

/**
 * Design Tokens Response
 * Returns design tokens in LLM-optimized structure
 */

/**
 * Token category types
 */
export type TokenCategory =
    | 'color'
    | 'typography'
    | 'spacing'
    | 'borderRadius'
    | 'shadow'
    | 'opacity'
    | 'other';

/**
 * Typography token value
 */
export interface TypographyValue {
    fontFamily: string;
    fontSize: number;
    fontWeight: FontWeight;
    lineHeight: number;
    letterSpacing: number;
    textAlign?: TextAlign;
}

/**
 * Spacing token value (in pixels)
 */
export type SpacingValue = number;

/**
 * Border radius token value (in pixels)
 */
export type BorderRadiusValue = number;

/**
 * Shadow token value
 */
export interface ShadowValue {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: Color;
}

/**
 * Opacity token value (0-1)
 */
export type OpacityValue = number;

/**
 * Token value union type
 */
export type TokenValue =
    | Color
    | TypographyValue
    | SpacingValue
    | BorderRadiusValue
    | ShadowValue
    | OpacityValue
    | string
    | number;

/**
 * Single design token
 */
export interface DesignToken {
    /** Token name (e.g., "primary-500", "heading-1", "spacing-md") */
    name: string;
    /** Token category */
    category: TokenCategory;
    /** Token value (type varies by category) */
    value: TokenValue;
    /** Optional description */
    description?: string;
    /** Optional usage guidance */
    usage?: string;
}

/**
 * Response for getDesignTokens tool
 */
export interface DesignTokensResponse extends PaginationMetadata {
    /** Array of design tokens */
    tokens: DesignToken[];
}

/**
 * Implementation Plan Response
 * Returns step-by-step implementation guidance and component mappings
 */

/**
 * Implementation step
 */
export interface ImplementationStep {
    /** Step number (1-indexed) */
    stepNumber: number;
    /** Step title */
    title: string;
    /** Step description */
    description: string;
    /** Related component IDs */
    relatedComponents?: NodeId[];
    /** Related design token names */
    relatedTokens?: string[];
    /** Code snippet or example */
    codeExample?: string;
}

/**
 * Component to code mapping suggestion
 */
export interface ComponentMapping {
    /** Figma component ID */
    componentId: NodeId;
    /** Figma component name */
    componentName: string;
    /** Suggested code component name */
    suggestedCodeName: string;
    /** Suggested file path (framework-agnostic) */
    suggestedFilePath: string;
    /** Layout strategy detected from Figma */
    layoutStrategy: {
        type: 'flexbox' | 'grid' | 'absolute' | 'none';
        reasoning: string;
        details?: Record<string, any>;
    };
    /** Styling approach recommendations */
    stylingApproach: {
        recommendations: string[];
        tokenUsage: string[];
        complexityNotes?: string;
    };
    /** Complexity score (0-10, higher = more complex) */
    complexityScore: number;
    /** Props/attributes to implement */
    props: Array<{
        name: string;
        type: string;
        description?: string;
        required: boolean;
    }>;
    /** Related design tokens */
    relatedTokens: string[];
    /** Implementation notes */
    notes?: string;
}

/**
 * Response for getImplementationPlan tool
 */
export interface ImplementationPlanResponse {
    /** Step-by-step implementation instructions */
    steps: ImplementationStep[];
    /** Component to code mappings */
    componentMappings: ComponentMapping[];
    /** Layout strategy guidance across the design */
    layoutGuidance: {
        primaryStrategy: string;
        patterns: Array<{
            pattern: string;
            occurrences: number;
            recommendation: string;
        }>;
        notes: string[];
    };
    /** Styling strategy guidance */
    stylingGuidance: {
        tokenCoverage: {
            colors: number;
            typography: number;
            spacing: number;
        };
        recommendations: string[];
        considerations: string[];
    };
    /** Open questions for developer consideration */
    openQuestions: Array<{
        question: string;
        context: string;
        relatedComponents?: NodeId[];
    }>;
    /** Implementation risks and warnings */
    risks: Array<{
        severity: 'low' | 'medium' | 'high';
        risk: string;
        impact: string;
        mitigation: string;
    }>;
    /** Overall implementation notes */
    notes?: string;
}
