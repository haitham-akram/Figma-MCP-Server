/**
 * Figma REST API Response Types
 * Raw types matching Figma API structure - NO transformation or normalization
 * Based on Figma REST API documentation
 */

/**
 * Generic Figma API error response
 */
export interface FigmaApiErrorResponse {
    status: number;
    err: string;
}

/**
 * Vector data for geometric shapes
 */
export interface Vector {
    x: number;
    y: number;
}

/**
 * Rectangle bounds
 */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Color in RGBA format (0-1 range)
 */
export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Paint types
 */
export type PaintType = 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI';

/**
 * Paint definition
 */
export interface Paint {
    type: PaintType;
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
    blendMode?: string;
    imageRef?: string;
    scaleMode?: string;
    imageTransform?: number[][];
}

/**
 * Type style (text properties)
 */
export interface TypeStyle {
    fontFamily: string;
    fontPostScriptName?: string;
    fontWeight: number;
    fontSize: number;
    textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
    letterSpacing: number;
    lineHeightPx: number;
    lineHeightPercent: number;
    lineHeightUnit: string;
}

/**
 * Effect types
 */
export type EffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';

/**
 * Effect definition
 */
export interface Effect {
    type: EffectType;
    visible?: boolean;
    radius: number;
    color?: FigmaColor;
    blendMode?: string;
    offset?: Vector;
}

/**
 * Node types in Figma
 */
export type FigmaNodeType =
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
    | 'INSTANCE'
    | 'SECTION'
    | 'STICKY'
    | 'SHAPE_WITH_TEXT'
    | 'CONNECTOR'
    | 'TABLE'
    | 'TABLE_CELL';

/**
 * Base node properties shared by all node types
 */
export interface BaseNode {
    id: string;
    name: string;
    type: FigmaNodeType;
    visible?: boolean;
}

/**
 * Node with children
 */
export interface NodeWithChildren extends BaseNode {
    children?: FigmaNode[];
}

/**
 * Document node (root)
 */
export interface DocumentNode extends NodeWithChildren {
    type: 'DOCUMENT';
}

/**
 * Canvas node (page)
 */
export interface CanvasNode extends NodeWithChildren {
    type: 'CANVAS';
    backgroundColor?: FigmaColor;
    prototypeStartNodeID?: string | null;
}

/**
 * Frame node
 */
export interface FrameNode extends NodeWithChildren {
    type: 'FRAME';
    absoluteBoundingBox?: Rect;
    background?: Paint[];
    backgroundColor?: FigmaColor;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    cornerRadius?: number;
    clipsContent?: boolean;
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
}

/**
 * Component node
 */
export interface ComponentNode extends NodeWithChildren {
    type: 'COMPONENT';
    absoluteBoundingBox?: Rect;
    background?: Paint[];
    backgroundColor?: FigmaColor;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    cornerRadius?: number;
    description?: string;
}

/**
 * Component set node (variant container)
 */
export interface ComponentSetNode extends NodeWithChildren {
    type: 'COMPONENT_SET';
    absoluteBoundingBox?: Rect;
    description?: string;
}

/**
 * Instance node (component instance)
 */
export interface InstanceNode extends NodeWithChildren {
    type: 'INSTANCE';
    absoluteBoundingBox?: Rect;
    componentId: string;
}

/**
 * Text node
 */
export interface TextNode extends BaseNode {
    type: 'TEXT';
    characters: string;
    style?: TypeStyle;
    fills?: Paint[];
    absoluteBoundingBox?: Rect;
    characterStyleOverrides?: number[];
    styleOverrideTable?: { [key: number]: Partial<TypeStyle> };
}

/**
 * Vector node
 */
export interface VectorNode extends BaseNode {
    type: 'VECTOR' | 'STAR' | 'LINE' | 'ELLIPSE' | 'REGULAR_POLYGON' | 'RECTANGLE';
    absoluteBoundingBox?: Rect;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    vectorPaths?: any[];
    exportSettings?: any[];
}

/**
 * Group node
 */
export interface GroupNode extends NodeWithChildren {
    type: 'GROUP';
    absoluteBoundingBox?: Rect;
}

/**
 * Boolean operation node
 */
export interface BooleanOperationNode extends NodeWithChildren {
    type: 'BOOLEAN_OPERATION';
    absoluteBoundingBox?: Rect;
    fills?: Paint[];
    strokes?: Paint[];
    strokeWeight?: number;
}

/**
 * Slice node
 */
export interface SliceNode extends BaseNode {
    type: 'SLICE';
    absoluteBoundingBox?: Rect;
}

/**
 * Section node (container for other nodes)
 */
export interface SectionNode extends NodeWithChildren {
    type: 'SECTION';
    fills?: Paint[];
}

/**
 * Union type of all node types
 */
export type FigmaNode =
    | DocumentNode
    | CanvasNode
    | FrameNode
    | ComponentNode
    | ComponentSetNode
    | InstanceNode
    | TextNode
    | VectorNode
    | GroupNode
    | BooleanOperationNode
    | SliceNode
    | SectionNode;

/**
 * Component metadata
 */
export interface Component {
    key: string;
    name: string;
    description: string;
    componentSetId?: string | null;
    documentationLinks?: string[];
}

/**
 * Component set metadata
 */
export interface ComponentSet {
    key: string;
    name: string;
    description: string;
}

/**
 * Style metadata
 */
export interface Style {
    key: string;
    name: string;
    description: string;
    styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

/**
 * File metadata response
 */
export interface FigmaFileResponse {
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    version: string;
    role: string;
    document: DocumentNode;
    components: Record<string, Component>;
    componentSets: Record<string, ComponentSet>;
    styles: Record<string, Style>;
    schemaVersion: number;
}

/**
 * File nodes response (for specific node queries)
 */
export interface FigmaFileNodesResponse {
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    version: string;
    role: string;
    nodes: Record<string, { document: FigmaNode } | { err: string }>;
}

/**
 * File versions response
 */
export interface FigmaFileVersionsResponse {
    versions: Array<{
        id: string;
        created_at: string;
        label: string;
        description: string;
        user: {
            id: string;
            handle: string;
            img_url: string;
        };
    }>;
}
