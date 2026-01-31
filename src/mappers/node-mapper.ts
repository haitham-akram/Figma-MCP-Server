/**
 * Node Mapper
 * Normalizes raw Figma nodes into semantic, LLM-friendly structures
 * 
 * Extracts design intent, not visual rendering properties
 */

import {
    FigmaNode,
    CanvasNode,
    FrameNode,
    ComponentNode,
    ComponentSetNode,
    InstanceNode,
    TextNode,
} from '../types/figma-api.js';
import {
    NormalizedNode,
    LayoutContainer,
    ComponentInstance,
    RoleDetectionResult,
    SemanticRole,
    LayoutStrategy,
    FlexboxRules,
    GridCandidate,
    ComponentReuse,
    TextElement,
    VisualElement,
} from '../types/normalized.js';
import { NodeId } from '../types/figma-base.js';

/**
 * Maximum nesting depth for component reuse tracking
 */
const MAX_REUSE_DEPTH = 4;

/**
 * Minimum instance count to be considered a design-system primitive
 */
const PRIMITIVE_THRESHOLD = 5;

/**
 * Normalize a Figma node into semantic structure
 * 
 * @param node - Raw Figma node
 * @param parentId - Parent node ID
 * @param componentContext - Context for tracking component reuse
 * @returns Normalized node
 */
export function normalizeNode(
    node: FigmaNode,
    parentId?: NodeId,
    componentContext?: ComponentReuse
): NormalizedNode | null {
    // Skip invisible nodes
    if (node.visible === false) {
        return null;
    }

    const semanticRole = identifySemanticRole(node);
    const base = {
        id: node.id,
        name: node.name,
        originalType: node.type,
        semanticRole,
        parentId,
        visible: node.visible === undefined ? true : node.visible,
    };

    // Determine node type and create appropriate normalized structure
    if (isLayoutNode(node)) {
        return {
            ...base,
            nodeType: 'layout' as const,
            data: extractLayoutIntent(node),
        };
    }

    if (node.type === 'TEXT') {
        return {
            ...base,
            nodeType: 'text' as const,
            data: extractTextElement(node as TextNode),
        };
    }

    if (isComponentNode(node)) {
        return {
            ...base,
            nodeType: 'component' as const,
            data: extractComponentInstance(node, componentContext),
        };
    }

    if (isVisualNode(node)) {
        return {
            ...base,
            nodeType: 'visual' as const,
            data: extractVisualElement(node),
        };
    }

    // Default to layout container for unknown types with children
    if ('children' in node && node.children) {
        return {
            ...base,
            nodeType: 'layout' as const,
            data: {
                strategy: 'none',
                children: node.children.map((child) => child.id),
                clipsContent: false,
                dimensions: { width: 0, height: 0 },
            },
        };
    }

    return null;
}

/**
 * Identify semantic role using hybrid detection
 * Priority: component type > structure > naming
 * 
 * @param node - Figma node
 * @returns Role detection result with confidence
 */
export function identifySemanticRole(node: FigmaNode): RoleDetectionResult {
    // 1. Component type detection (highest priority)
    const componentTypeRole = detectFromComponentType(node);
    if (componentTypeRole && componentTypeRole.confidence > 0.7) {
        return componentTypeRole;
    }

    // 2. Structural analysis
    const structuralRole = detectFromStructure(node);
    if (structuralRole && structuralRole.confidence > 0.7) {
        return structuralRole;
    }

    // 3. Name pattern matching (lowest priority, used to boost confidence)
    const namingRole = detectFromNaming(node);

    // Combine structural and naming if both agree
    if (structuralRole && namingRole && structuralRole.role === namingRole.role) {
        return {
            role: structuralRole.role,
            confidence: Math.min(structuralRole.confidence + 0.2, 1.0),
            detectionMethod: 'hybrid',
            reasoning: `Structural analysis and naming both suggest ${structuralRole.role}`,
        };
    }

    // Structural overrides naming on conflict
    if (structuralRole && namingRole && structuralRole.role !== namingRole.role) {
        return {
            ...structuralRole,
            detectionMethod: 'structural',
            reasoning: `Structural pattern (${structuralRole.role}) overrides naming hint (${namingRole.role})`,
        };
    }

    // Return best available or unknown
    return structuralRole || componentTypeRole || namingRole || {
        role: 'unknown',
        confidence: 0,
        detectionMethod: 'hybrid',
        reasoning: 'No semantic role detected',
    };
}

/**
 * Detect role from Figma component type
 */
function detectFromComponentType(node: FigmaNode): RoleDetectionResult | null {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
        // Component type alone doesn't determine semantic role
        // This is a fallback that provides moderate confidence
        return {
            role: 'container',
            confidence: 0.6,
            detectionMethod: 'component-type',
            reasoning: `Figma component of type ${node.type}`,
        };
    }
    return null;
}

/**
 * Detect role from structural patterns
 * Examples:
 * - Text + icon + background = button
 * - Rectangle + text + border = input
 * - Repeated items in vertical/horizontal layout = list
 */
function detectFromStructure(node: FigmaNode): RoleDetectionResult | null {
    if (!('children' in node) || !node.children) {
        // Leaf nodes
        if (node.type === 'TEXT') {
            return {
                role: 'text',
                confidence: 0.9,
                detectionMethod: 'structural',
                reasoning: 'Text node',
            };
        }
        if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
            return {
                role: 'container',
                confidence: 0.5,
                detectionMethod: 'structural',
                reasoning: 'Simple shape',
            };
        }
        return null;
    }

    const children = node.children;
    const childTypes = children.map((c) => c.type);

    // Button pattern: background + text (+ optional icon)
    if (hasBackground(node) && childTypes.includes('TEXT')) {
        const hasIcon = childTypes.some((t) => t === 'VECTOR' || t === 'ELLIPSE');
        if (children.length <= 3) {
            return {
                role: 'button',
                confidence: hasIcon ? 0.85 : 0.75,
                detectionMethod: 'structural',
                reasoning: `Background + text${hasIcon ? ' + icon' : ''} suggests button`,
            };
        }
    }

    // Input pattern: rectangle + text with specific styling
    if (node.type === 'FRAME' && hasFrame(node)) {
        const hasText = childTypes.includes('TEXT');
        const hasBorder = hasStroke(node);
        if (hasText && hasBorder && children.length <= 2) {
            return {
                role: 'input',
                confidence: 0.8,
                detectionMethod: 'structural',
                reasoning: 'Frame with border + text suggests input field',
            };
        }
    }

    // List pattern: repeated similar children
    if (children.length >= 3) {
        const allSameType = childTypes.every((t) => t === childTypes[0]);
        if (allSameType && (node.type === 'FRAME' || node.type === 'GROUP')) {
            return {
                role: 'list',
                confidence: 0.7,
                detectionMethod: 'structural',
                reasoning: `${children.length} repeated elements suggest list`,
            };
        }
    }

    // Card pattern: container with mixed content
    if (children.length >= 2 && hasBackground(node)) {
        const hasText = childTypes.includes('TEXT');
        const hasVisuals = childTypes.some((t) => ['RECTANGLE', 'ELLIPSE', 'VECTOR'].includes(t));
        if (hasText && hasVisuals) {
            return {
                role: 'card',
                confidence: 0.65,
                detectionMethod: 'structural',
                reasoning: 'Container with background, text, and visuals suggests card',
            };
        }
    }

    return null;
}

/**
 * Detect role from naming patterns (lowest priority)
 */
function detectFromNaming(node: FigmaNode): RoleDetectionResult | null {
    const name = node.name.toLowerCase();

    const patterns: Array<{ keywords: string[]; role: SemanticRole }> = [
        { keywords: ['btn', 'button'], role: 'button' },
        { keywords: ['input', 'field', 'textbox'], role: 'input' },
        { keywords: ['card'], role: 'card' },
        { keywords: ['list'], role: 'list' },
        { keywords: ['nav', 'navigation'], role: 'navigation' },
        { keywords: ['header'], role: 'header' },
        { keywords: ['footer'], role: 'footer' },
        { keywords: ['modal', 'dialog'], role: 'modal' },
        { keywords: ['icon'], role: 'icon' },
        { keywords: ['avatar'], role: 'avatar' },
        { keywords: ['badge'], role: 'badge' },
    ];

    for (const { keywords, role } of patterns) {
        if (keywords.some((kw) => name.includes(kw))) {
            return {
                role,
                confidence: 0.4,
                detectionMethod: 'naming',
                reasoning: `Name "${node.name}" matches pattern for ${role}`,
            };
        }
    }

    return null;
}

/**
 * Extract layout intent from a node
 */
function extractLayoutIntent(node: FrameNode | CanvasNode): Omit<LayoutContainer, 'id' | 'name'> {
    const strategy = determineLayoutStrategy(node);
    const boundingBox = 'absoluteBoundingBox' in node ? node.absoluteBoundingBox : undefined;
    const dimensions = boundingBox
        ? { width: boundingBox.width, height: boundingBox.height }
        : { width: 0, height: 0 };

    const container: Omit<LayoutContainer, 'id' | 'name'> = {
        strategy,
        children: node.children?.map((c) => c.id) || [],
        clipsContent: 'clipsContent' in node ? node.clipsContent || false : false,
        dimensions,
    };

    if (strategy === 'flexbox' && 'layoutMode' in node && node.layoutMode) {
        container.flexbox = extractFlexboxRules(node as FrameNode);
    }

    if (strategy === 'grid-candidate' && node.children && node.type === 'FRAME') {
        container.grid = detectGridPattern(node as FrameNode);
    }

    return container;
}

/**
 * Determine layout strategy for a container
 */
function determineLayoutStrategy(node: FrameNode | CanvasNode): LayoutStrategy {
    if (!('layoutMode' in node)) {
        return 'none';
    }

    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
        // Check for 2D grid pattern
        if (node.children && hasGridPattern(node)) {
            return 'grid-candidate';
        }
        return 'flexbox';
    }

    return 'none';
}

/**
 * Extract Flexbox rules from Figma Auto Layout
 */
function extractFlexboxRules(node: FrameNode): FlexboxRules {
    const direction = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';

    // Map Figma alignment to CSS justify-content
    const justifyContent = mapPrimaryAxisAlign(node);

    // Map Figma alignment to CSS align-items
    const alignItems = mapCounterAxisAlign(node);

    return {
        direction,
        justifyContent,
        alignItems,
        gap: (node as any).itemSpacing || 0,
        padding: extractPadding(node),
    };
}

/**
 * Map Figma primaryAxisAlignItems to CSS justify-content
 */
function mapPrimaryAxisAlign(node: any): FlexboxRules['justifyContent'] {
    const align = node.primaryAxisAlignItems;
    const alignMap: Record<string, FlexboxRules['justifyContent']> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
        'SPACE_BETWEEN': 'space-between',
    };
    return alignMap[align] || 'flex-start';
}

/**
 * Map Figma counterAxisAlignItems to CSS align-items
 */
function mapCounterAxisAlign(node: any): FlexboxRules['alignItems'] {
    const align = node.counterAxisAlignItems;
    const alignMap: Record<string, FlexboxRules['alignItems']> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
    };
    return alignMap[align] || 'stretch';
}

/**
 * Extract padding from Auto Layout
 */
function extractPadding(node: any): FlexboxRules['padding'] | undefined {
    if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
        return {
            top: node.paddingTop || 0,
            right: node.paddingRight || 0,
            bottom: node.paddingBottom || 0,
            left: node.paddingLeft || 0,
        };
    }
    return undefined;
}

/**
 * Detect grid pattern in children (2D repetition)
 */
function hasGridPattern(node: FrameNode): boolean {
    if (!node.children || node.children.length < 4) {
        return false;
    }

    // Simple heuristic: if children have consistent positioning in both axes
    const positions = node.children
        .map((c: any) => c.absoluteBoundingBox)
        .filter(Boolean);

    if (positions.length < 4) {
        return false;
    }

    // Check for alignment on both axes
    const xPositions = positions.map((p) => p.x);
    const yPositions = positions.map((p) => p.y);

    const uniqueX = new Set(xPositions.map((x) => Math.round(x)));
    const uniqueY = new Set(yPositions.map((y) => Math.round(y)));

    // Grid if we have multiple unique positions on both axes
    return uniqueX.size >= 2 && uniqueY.size >= 2;
}

/**
 * Detect grid metadata
 */
function detectGridPattern(node: FrameNode): GridCandidate | undefined {
    if (!node.children) {
        return undefined;
    }

    const positions = node.children
        .map((c: any) => ({ id: c.id, box: c.absoluteBoundingBox }))
        .filter((p) => p.box);

    const xPositions = [...new Set(positions.map((p) => Math.round(p.box.x)))].sort((a, b) => a - b);
    const yPositions = [...new Set(positions.map((p) => Math.round(p.box.y)))].sort((a, b) => a - b);

    const columnGap = xPositions.length > 1 ? xPositions[1] - xPositions[0] : 0;
    const rowGap = yPositions.length > 1 ? yPositions[1] - yPositions[0] : 0;

    return {
        columns: xPositions.length,
        rows: yPositions.length,
        columnGap,
        rowGap,
        isUniform: true, // Simplified - would need more analysis
    };
}

/**
 * Extract text element data
 */
function extractTextElement(node: TextNode): Omit<TextElement, 'id' | 'name'> {
    const typography = extractTypographyFromNode(node);
    const color = extractTextColor(node);

    return {
        content: node.characters,
        typography,
        color,
        isTruncated: false, // Would need additional analysis
    };
}

/**
 * Extract typography from text node
 */
function extractTypographyFromNode(node: TextNode): any {
    const style = node.style;
    if (!style) {
        return {
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 20,
            letterSpacing: 0,
            textAlign: 'LEFT',
        };
    }

    return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight as any,
        lineHeight: style.lineHeightPx,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlignHorizontal as any,
    };
}

/**
 * Extract text color
 */
function extractTextColor(node: TextNode): any {
    if (!node.fills || !Array.isArray(node.fills) || node.fills.length === 0) {
        return undefined;
    }

    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.color) {
        return fill.color;
    }

    return undefined;
}

/**
 * Extract component instance data
 */
function extractComponentInstance(
    node: ComponentNode | ComponentSetNode | InstanceNode,
    componentContext?: ComponentReuse
): Omit<ComponentInstance, 'id' | 'name'> {
    const dimensions = node.absoluteBoundingBox
        ? { width: node.absoluteBoundingBox.width, height: node.absoluteBoundingBox.height }
        : { width: 0, height: 0 };

    const reuse: ComponentReuse = componentContext || {
        rootComponentId: node.id,
        rootComponentName: node.name,
        nestingPath: [node.id],
        nestingDepth: 0,
        instanceCount: 1,
        isPrimitive: false,
    };

    return {
        componentType: node.type === 'COMPONENT' ? 'component' : node.type === 'COMPONENT_SET' ? 'component-set' : 'instance',
        description: 'description' in node ? node.description : undefined,
        reuse,
        children: 'children' in node && node.children ? node.children.map((c) => c.id) : [],
        dimensions,
    };
}

/**
 * Extract visual element data
 */
function extractVisualElement(node: FigmaNode): Omit<VisualElement, 'id' | 'name'> {
    const dimensions = 'absoluteBoundingBox' in node && node.absoluteBoundingBox
        ? { width: node.absoluteBoundingBox.width, height: node.absoluteBoundingBox.height }
        : { width: 0, height: 0 };

    const visual = extractVisualIntent(node);
    const type = mapNodeTypeToVisualType(node.type);

    return {
        type,
        visual,
        dimensions,
    };
}

/**
 * Extract visual intent from node
 */
function extractVisualIntent(node: any): any {
    const backgroundColor = extractBackgroundColor(node);
    const border = extractBorder(node);
    const shadow = extractShadow(node);
    const opacity = node.opacity !== undefined ? node.opacity : 1;

    return {
        backgroundColor,
        border,
        shadow,
        opacity,
    };
}

/**
 * Extract background color
 */
function extractBackgroundColor(node: any): any {
    if (node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.color) {
            return fill.color;
        }
    }
    if (node.backgroundColor) {
        return node.backgroundColor;
    }
    return undefined;
}

/**
 * Extract border properties
 */
function extractBorder(node: any): any {
    if (!node.strokes || node.strokes.length === 0) {
        return undefined;
    }

    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID' && stroke.color) {
        return {
            color: stroke.color,
            width: node.strokeWeight || 1,
            radius: node.cornerRadius || 0,
        };
    }

    return undefined;
}

/**
 * Extract shadow properties
 */
function extractShadow(node: any): any {
    if (!node.effects || node.effects.length === 0) {
        return undefined;
    }

    const shadow = node.effects.find((e: any) => e.type === 'DROP_SHADOW');
    if (shadow && shadow.color) {
        return {
            offsetX: shadow.offset?.x || 0,
            offsetY: shadow.offset?.y || 0,
            blur: shadow.radius || 0,
            spread: 0,
            color: shadow.color,
        };
    }

    return undefined;
}

/**
 * Map Figma node type to visual element type
 */
function mapNodeTypeToVisualType(type: string): VisualElement['type'] {
    const typeMap: Record<string, VisualElement['type']> = {
        'RECTANGLE': 'rectangle',
        'ELLIPSE': 'ellipse',
        'VECTOR': 'vector',
        'STAR': 'icon',
        'LINE': 'vector',
    };
    return typeMap[type] || 'rectangle';
}

/**
 * Build component hierarchy map
 * 
 * @param nodes - Array of Figma nodes
 * @returns Map of nodeId -> parentId
 */
export function buildComponentHierarchy(nodes: FigmaNode[]): Map<NodeId, NodeId> {
    const hierarchy = new Map<NodeId, NodeId>();

    function traverse(node: FigmaNode, parentId?: NodeId) {
        if (parentId) {
            hierarchy.set(node.id, parentId);
        }

        if ('children' in node && node.children) {
            for (const child of node.children) {
                traverse(child, node.id);
            }
        }
    }

    for (const node of nodes) {
        traverse(node);
    }

    return hierarchy;
}

/**
 * Track component reuse across document
 * 
 * @param nodes - All nodes in document
 * @param maxDepth - Maximum nesting depth to track
 * @returns Map of componentId -> instance IDs
 */
export function trackComponentReuse(
    nodes: FigmaNode[],
    maxDepth: number = MAX_REUSE_DEPTH
): Map<NodeId, NodeId[]> {
    const reuseMap = new Map<NodeId, NodeId[]>();
    const visited = new Set<NodeId>();

    function traverse(node: FigmaNode, depth: number = 0) {
        if (depth > maxDepth || visited.has(node.id)) {
            return;
        }
        visited.add(node.id);

        if (node.type === 'INSTANCE' && 'componentId' in node) {
            const componentId = (node as InstanceNode).componentId;
            const instances = reuseMap.get(componentId) || [];
            instances.push(node.id);
            reuseMap.set(componentId, instances);
        }

        if ('children' in node && node.children) {
            for (const child of node.children) {
                traverse(child, depth + 1);
            }
        }
    }

    for (const node of nodes) {
        traverse(node);
    }

    return reuseMap;
}

// Helper type guards

function isLayoutNode(node: FigmaNode): node is FrameNode | CanvasNode {
    return node.type === 'FRAME' || node.type === 'CANVAS';
}

function isComponentNode(node: FigmaNode): node is ComponentNode | ComponentSetNode | InstanceNode {
    return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
}

function isVisualNode(node: FigmaNode): boolean {
    return ['RECTANGLE', 'ELLIPSE', 'VECTOR', 'STAR', 'LINE'].includes(node.type);
}

function hasBackground(node: any): boolean {
    return !!(node.fills && node.fills.length > 0) || !!node.backgroundColor;
}

function hasStroke(node: any): boolean {
    return !!(node.strokes && node.strokes.length > 0);
}

function hasFrame(node: any): boolean {
    return !!node.absoluteBoundingBox;
}
