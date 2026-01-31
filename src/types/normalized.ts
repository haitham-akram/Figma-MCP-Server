/**
 * Normalized Figma Types
 * Semantic, LLM-friendly types that extract design intent from raw Figma data
 * 
 * These types represent the abstraction layer between raw Figma API and MCP tools
 */

import { NodeId, Color, FontWeight, TextAlign } from './figma-base.js';

/**
 * Semantic roles for UI elements
 * Detected through hybrid analysis (component type > structure > naming)
 */
export type SemanticRole =
    | 'button'
    | 'input'
    | 'checkbox'
    | 'radio'
    | 'select'
    | 'card'
    | 'list'
    | 'list-item'
    | 'navigation'
    | 'header'
    | 'footer'
    | 'sidebar'
    | 'modal'
    | 'dialog'
    | 'alert'
    | 'badge'
    | 'avatar'
    | 'icon'
    | 'image'
    | 'text'
    | 'heading'
    | 'paragraph'
    | 'link'
    | 'divider'
    | 'container'
    | 'unknown';

/**
 * Layout strategy for containers
 */
export type LayoutStrategy =
    | 'flexbox'        // Default: Auto Layout maps to Flexbox
    | 'grid-candidate' // Two-dimensional repetition detected
    | 'absolute'       // Positioned elements
    | 'none';          // No layout properties

/**
 * Flexbox-like layout rules translated from Figma Auto Layout
 */
export interface FlexboxRules {
    /** CSS flex-direction (from layoutMode) */
    direction: 'row' | 'column';
    /** CSS justify-content (from primaryAxisAlignItems) */
    justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
    /** CSS align-items (from counterAxisAlignItems) */
    alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
    /** CSS gap (from itemSpacing) */
    gap: number;
    /** Padding (from Auto Layout padding) */
    padding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    /** Whether children should wrap */
    wrap?: boolean;
}

/**
 * Grid candidate metadata (for containers showing 2D patterns)
 */
export interface GridCandidate {
    /** Number of columns detected */
    columns: number;
    /** Number of rows detected */
    rows: number;
    /** Gap between columns */
    columnGap: number;
    /** Gap between rows */
    rowGap: number;
    /** Whether grid is uniform */
    isUniform: boolean;
}

/**
 * Layout container with semantic layout information
 */
export interface LayoutContainer {
    /** Container node ID */
    id: NodeId;
    /** Container name */
    name: string;
    /** Layout strategy */
    strategy: LayoutStrategy;
    /** Flexbox rules (if strategy is 'flexbox') */
    flexbox?: FlexboxRules;
    /** Grid metadata (if strategy is 'grid-candidate') */
    grid?: GridCandidate;
    /** Child node IDs in layout order */
    children: NodeId[];
    /** Whether container clips content */
    clipsContent: boolean;
    /** Dimensions */
    dimensions: {
        width: number;
        height: number;
    };
}

/**
 * Typography intent extracted from text nodes
 */
export interface TypographyIntent {
    /** Font family */
    fontFamily: string;
    /** Font size in pixels */
    fontSize: number;
    /** Font weight */
    fontWeight: FontWeight;
    /** Line height in pixels */
    lineHeight: number;
    /** Letter spacing in pixels */
    letterSpacing: number;
    /** Text alignment */
    textAlign: TextAlign;
    /** Detected semantic level (h1, h2, body, caption, etc.) */
    semanticLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption' | 'label';
}

/**
 * Text element with design intent
 */
export interface TextElement {
    /** Node ID */
    id: NodeId;
    /** Node name */
    name: string;
    /** Text content */
    content: string;
    /** Typography intent */
    typography: TypographyIntent;
    /** Text color */
    color?: Color;
    /** Whether text is truncated */
    isTruncated: boolean;
    /** Maximum lines (if truncated) */
    maxLines?: number;
}

/**
 * Visual styling intent (colors, borders, shadows)
 */
export interface VisualIntent {
    /** Background color */
    backgroundColor?: Color;
    /** Border properties */
    border?: {
        color: Color;
        width: number;
        radius: number;
    };
    /** Shadow properties */
    shadow?: {
        offsetX: number;
        offsetY: number;
        blur: number;
        spread: number;
        color: Color;
    };
    /** Opacity (0-1) */
    opacity: number;
}

/**
 * Visual element (non-text, non-layout)
 */
export interface VisualElement {
    /** Node ID */
    id: NodeId;
    /** Node name */
    name: string;
    /** Element type */
    type: 'rectangle' | 'ellipse' | 'vector' | 'icon' | 'image';
    /** Visual styling */
    visual: VisualIntent;
    /** Dimensions */
    dimensions: {
        width: number;
        height: number;
    };
}

/**
 * Component reuse metadata
 */
export interface ComponentReuse {
    /** Root component ID (top-level component definition) */
    rootComponentId: NodeId;
    /** Root component name */
    rootComponentName: string;
    /** Nesting path from root to this instance */
    nestingPath: NodeId[];
    /** Nesting depth (0 = direct instance, 1+ = nested) */
    nestingDepth: number;
    /** Total instance count across design */
    instanceCount: number;
    /** Whether this is a design-system primitive (high reuse) */
    isPrimitive: boolean;
}

/**
 * Component instance with reuse tracking
 */
export interface ComponentInstance {
    /** Instance node ID */
    id: NodeId;
    /** Instance name */
    name: string;
    /** Component type */
    componentType: 'component' | 'component-set' | 'instance';
    /** Component description */
    description?: string;
    /** Reuse metadata */
    reuse: ComponentReuse;
    /** Child node IDs */
    children: NodeId[];
    /** Variant properties (for component sets) */
    variants?: Array<{
        property: string;
        value: string;
    }>;
    /** Dimensions */
    dimensions: {
        width: number;
        height: number;
    };
}

/**
 * Semantic role detection confidence
 */
export interface RoleDetectionResult {
    /** Detected role */
    role: SemanticRole;
    /** Confidence score (0-1) */
    confidence: number;
    /** Detection method used */
    detectionMethod: 'component-type' | 'structural' | 'naming' | 'hybrid';
    /** Reasoning for detection */
    reasoning: string;
}

/**
 * Base normalized node (common properties)
 */
export interface NormalizedNodeBase {
    /** Node ID */
    id: NodeId;
    /** Node name */
    name: string;
    /** Original Figma node type */
    originalType: string;
    /** Semantic role detected */
    semanticRole: RoleDetectionResult;
    /** Parent node ID */
    parentId?: NodeId;
    /** Whether node is visible */
    visible: boolean;
}

/**
 * Normalized node (union of all normalized types)
 */
export type NormalizedNode =
    | (NormalizedNodeBase & { nodeType: 'layout'; data: Omit<LayoutContainer, 'id' | 'name'> })
    | (NormalizedNodeBase & { nodeType: 'text'; data: Omit<TextElement, 'id' | 'name'> })
    | (NormalizedNodeBase & { nodeType: 'visual'; data: Omit<VisualElement, 'id' | 'name'> })
    | (NormalizedNodeBase & { nodeType: 'component'; data: Omit<ComponentInstance, 'id' | 'name'> });

/**
 * Normalized document structure
 */
export interface NormalizedDocument {
    /** File name */
    fileName: string;
    /** File version */
    version: string;
    /** All normalized nodes (flat map) */
    nodes: Map<NodeId, NormalizedNode>;
    /** Component hierarchy (nodeId -> parentId) */
    componentHierarchy: Map<NodeId, NodeId>;
    /** Component reuse map (componentId -> instanceIds[]) */
    componentReuse: Map<NodeId, NodeId[]>;
    /** Root node IDs (pages) */
    rootNodes: NodeId[];
}
