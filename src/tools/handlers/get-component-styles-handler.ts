/**
 * Get Component Styles Handler
 * Extracts comprehensive styling information including all visual properties
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetComponentStylesInput } from '../figma/get-component-styles.js';
import { FigmaNode, Paint, TypeStyle, Effect, FigmaColor } from '../../types/figma-api.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

/**
 * Detailed style information for an element
 */
export interface ElementStyle {
    id: string;
    name: string;
    type: string;

    // Layout & dimensions
    dimensions?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };

    // Colors & fills
    backgroundColor?: string;
    fills?: Array<{
        type: string;
        color?: string;
        opacity?: number;
        visible?: boolean;
        imageUrl?: string; // For IMAGE fills
    }>;

    // Borders & strokes
    strokes?: Array<{
        type: string;
        color?: string;
        opacity?: number;
        visible?: boolean;
    }>;
    strokeWeight?: number;
    cornerRadius?: number | number[];

    // Typography (for text nodes)
    text?: {
        content: string;
        fontFamily: string;
        fontWeight: number;
        fontSize: number;
        lineHeight: string;
        letterSpacing: number;
        textAlign: string;
        textColor: string;
        mixedStyles?: Array<{
            startIndex: number;
            endIndex: number;
            fontFamily?: string;
            fontWeight?: number;
            fontSize?: number;
            color?: string;
        }>;
    };

    // Vector information
    vector?: {
        isVector: boolean;
        vectorType?: string;
        hasExportSettings: boolean;
    };

    // Effects (shadows, blurs)
    effects?: Array<{
        type: string;
        radius: number;
        color?: string;
        offset?: { x: number; y: number };
        visible?: boolean;
    }>;

    // Layout properties
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
    layoutAlign?: string;
    layoutGrow?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
    itemSpacing?: number;

    // Constraints
    constraints?: {
        horizontal: string;
        vertical: string;
    };

    // Visual properties
    opacity?: number;
    blendMode?: string;
    clipsContent?: boolean;

    // Children (if includeChildren is true)
    children?: ElementStyle[];
}

/**
 * Component styles response
 */
export interface ComponentStylesResponse {
    componentId: string;
    componentName: string;
    componentType: string;
    styles: ElementStyle;

    // Extracted resources
    images: Array<{
        nodeId: string;
        nodeName: string;
        imageRef?: string;
        imageUrl: string;
    }>;

    vectors: Array<{
        nodeId: string;
        nodeName: string;
        vectorType: string;
        canExport: boolean;
    }>;

    // Color palette used in this component
    colors: Array<{
        value: string;
        usage: string; // "fill", "stroke", "text", "shadow"
        count: number;
    }>;

    // Typography used
    fonts: Array<{
        family: string;
        weight: number;
        size: number;
        usage: string; // e.g., "heading", "body", "caption"
    }>;
}

/**
 * Handle getComponentStyles tool execution
 */
export async function handleGetComponentStyles(
    input: GetComponentStylesInput,
    figmaClient: FigmaClient
): Promise<ComponentStylesResponse> {
    const { fileKey, componentId, version, includeChildren = true } = input;

    // Check cache
    const cacheManager = getCacheManager();
    const cacheKey = `${fileKey}:${componentId}:${version || 'latest'}:styles`;
    if (cacheManager) {
        const cached = await cacheManager.get<ComponentStylesResponse>(cacheKey);
        if (cached) {
            console.error(`[Cache] Found processed styles for component ${componentId}`);
            return cached;
        }
    }

    // Fetch file data
    const fileData = await figmaClient.getFile(fileKey, { version });

    // Find the specific component/frame
    const targetNode = findNodeById(fileData.document, componentId);
    if (!targetNode) {
        throw new Error(`Component/frame with ID "${componentId}" not found in file`);
    }

    // Extract detailed styles
    const styles = extractElementStyles(targetNode, includeChildren);

    // Extract all resources
    const images = extractImages(targetNode);
    const vectors = extractVectors(targetNode);
    const colors = extractColorPalette(targetNode);
    const fonts = extractFonts(targetNode);

    const response: ComponentStylesResponse = {
        componentId: targetNode.id,
        componentName: targetNode.name,
        componentType: targetNode.type,
        styles,
        images,
        vectors,
        colors,
        fonts,
    };

    // Cache the result
    if (cacheManager) {
        await cacheManager.set(cacheKey, response, 'components');
    }

    return response;
}

/**
 * Find node by ID in tree
 */
function findNodeById(root: FigmaNode, targetId: string): FigmaNode | null {
    if (root.id === targetId) {
        return root;
    }

    if ('children' in root && root.children) {
        for (const child of root.children) {
            const found = findNodeById(child, targetId);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Extract complete style information for a node
 */
function extractElementStyles(node: FigmaNode, includeChildren: boolean): ElementStyle {
    const style: ElementStyle = {
        id: node.id,
        name: node.name,
        type: node.type,
    };

    // Dimensions
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
        const box = node.absoluteBoundingBox;
        style.dimensions = {
            width: box.width,
            height: box.height,
            x: box.x,
            y: box.y,
        };
    }

    // Background color (legacy property)
    if ('backgroundColor' in node && node.backgroundColor) {
        style.backgroundColor = figmaColorToHex(node.backgroundColor);
    }

    // Fills (modern property)
    if ('fills' in node && node.fills && Array.isArray(node.fills)) {
        style.fills = node.fills.map((fill: Paint) => {
            const fillData: any = {
                type: fill.type,
                color: fill.color ? figmaColorToHex(fill.color) : undefined,
                opacity: fill.opacity ?? 1,
                visible: fill.visible ?? true,
            };

            if (fill.type === 'IMAGE' && fill.imageRef) {
                fillData.imageUrl = `IMAGE_REF:${fill.imageRef}`;
            } else if (fill.type === 'IMAGE') {
                fillData.imageUrl = '(IMAGE_FILL_DETECTED)';
            }

            return fillData;
        });
    }

    // Strokes
    if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
        style.strokes = node.strokes.map((stroke: Paint) => ({
            type: stroke.type,
            color: stroke.color ? figmaColorToHex(stroke.color) : undefined,
            opacity: stroke.opacity ?? 1,
            visible: stroke.visible ?? true,
        }));
    }

    if ('strokeWeight' in node && node.strokeWeight != null) {
        style.strokeWeight = node.strokeWeight;
    }

    if ('cornerRadius' in node && node.cornerRadius != null) {
        style.cornerRadius = node.cornerRadius;
    }

    // Typography (text nodes)
    if (node.type === 'TEXT' && 'characters' in node && 'style' in node) {
        const textNode = node as any;
        const textStyle = textNode.style as TypeStyle | undefined;
        const fills = textNode.fills as Paint[] | undefined;

        let textColor = '#000000';
        if (fills && fills[0]?.color) {
            textColor = figmaColorToHex(fills[0].color);
        }

        if (textStyle) {
            const textData: any = {
                content: textNode.characters,
                fontFamily: textStyle.fontFamily,
                fontWeight: textStyle.fontWeight,
                fontSize: textStyle.fontSize,
                lineHeight: formatLineHeight(textStyle),
                letterSpacing: textStyle.letterSpacing,
                textAlign: textStyle.textAlignHorizontal,
                textColor,
            };

            // Extract mixed styles (different font weights/sizes in same text)
            if (textNode.characterStyleOverrides && textNode.styleOverrideTable) {
                const mixedStyles: any[] = [];
                const overrides = textNode.characterStyleOverrides as number[];
                const table = textNode.styleOverrideTable as { [key: number]: Partial<TypeStyle> };

                // Group consecutive characters with same style
                let currentStyleId: number | null = null;
                let startIndex = 0;

                for (let i = 0; i <= overrides.length; i++) {
                    const styleId = i < overrides.length ? overrides[i] : null;

                    if (styleId !== currentStyleId && currentStyleId !== null && currentStyleId !== 0) {
                        const override = table[currentStyleId];
                        if (override) {
                            // Prefer color defined in the override's fills, fall back to base fills
                            const overrideFillColor =
                                (override as any).fills && (override as any).fills[0]?.color
                                    ? figmaColorToHex((override as any).fills[0].color as FigmaColor)
                                    : (fills && fills[0]?.color ? figmaColorToHex(fills[0].color) : undefined);

                            mixedStyles.push({
                                startIndex,
                                endIndex: i,
                                fontFamily: override.fontFamily,
                                fontWeight: override.fontWeight,
                                fontSize: override.fontSize,
                                color: overrideFillColor,
                            });
                        }
                        startIndex = i;
                    }
                    currentStyleId = styleId;
                }

                if (mixedStyles.length > 0) {
                    textData.mixedStyles = mixedStyles;
                }
            }

            style.text = textData;
        }
    }

    // Vector information
    const vectorTypes = ['VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'RECTANGLE'];
    if (vectorTypes.includes(node.type)) {
        style.vector = {
            isVector: true,
            vectorType: node.type,
            hasExportSettings: !!(node as any).exportSettings,
        };
    }

    // Effects (shadows, blurs)
    if ('effects' in node && (node as any).effects && Array.isArray((node as any).effects)) {
        const effects = (node as any).effects as Effect[];
        style.effects = effects.map((effect) => ({
            type: effect.type,
            radius: effect.radius,
            color: effect.color ? figmaColorToHex(effect.color) : undefined,
            offset: effect.offset ? { x: effect.offset.x, y: effect.offset.y } : undefined,
            visible: effect.visible ?? true,
        }));
    }

    // Layout properties
    if ('layoutMode' in node) {
        style.layoutMode = (node as any).layoutMode;
    }

    if ('itemSpacing' in node && (node as any).itemSpacing != null) {
        style.itemSpacing = (node as any).itemSpacing;
    }

    if ('paddingTop' in node) {
        const n = node as any;
        style.padding = {
            top: n.paddingTop ?? 0,
            right: n.paddingRight ?? 0,
            bottom: n.paddingBottom ?? 0,
            left: n.paddingLeft ?? 0,
        };
    }

    if ('layoutAlign' in node) {
        style.layoutAlign = (node as any).layoutAlign;
    }

    if ('layoutGrow' in node) {
        style.layoutGrow = (node as any).layoutGrow;
    }

    // Visual properties
    if ('opacity' in node && (node as any).opacity != null) {
        style.opacity = (node as any).opacity;
    }

    if ('blendMode' in node) {
        style.blendMode = (node as any).blendMode;
    }

    if ('clipsContent' in node) {
        style.clipsContent = (node as any).clipsContent;
    }

    // Constraints
    if ('constraints' in node && (node as any).constraints) {
        const c = (node as any).constraints;
        style.constraints = {
            horizontal: c.horizontal || 'LEFT',
            vertical: c.vertical || 'TOP',
        };
    }

    // Children
    if (includeChildren && 'children' in node && node.children) {
        style.children = node.children.map((child) => extractElementStyles(child, true));
    }

    return style;
}

/**
 * Extract all images from node tree
 */
function extractImages(node: FigmaNode): ComponentStylesResponse['images'] {
    const images: ComponentStylesResponse['images'] = [];

    function traverse(n: FigmaNode) {
        // Check for IMAGE fills
        if ('fills' in n && n.fills && Array.isArray(n.fills)) {
            const fills = n.fills as Paint[];
            for (const fill of fills) {
                if (fill.type === 'IMAGE') {
                    // Note: imageUrl is a descriptive placeholder. To obtain an actual
                    // image URL, use the Figma Images API with this imageRef and the file key.
                    images.push({
                        nodeId: n.id,
                        nodeName: n.name,
                        imageRef: fill.imageRef,
                        imageUrl: fill.imageRef
                            ? `Requires Figma Images API: imageRef=${fill.imageRef}`
                            : '(IMAGE_WITHOUT_REF)',
                    });
                }
            }
        }

        // Traverse children
        if ('children' in n && n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);
    return images;
}

/**
 * Extract all vector elements from node tree
 */
function extractVectors(node: FigmaNode): ComponentStylesResponse['vectors'] {
    const vectors: ComponentStylesResponse['vectors'] = [];
    const vectorTypes = ['VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'RECTANGLE'];

    function traverse(n: FigmaNode) {
        if (vectorTypes.includes(n.type)) {
            vectors.push({
                nodeId: n.id,
                nodeName: n.name,
                vectorType: n.type,
                canExport: !!(n as any).exportSettings || n.name.toLowerCase().includes('icon'),
            });
        }

        // Traverse children
        if ('children' in n && n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);
    return vectors;
}

/**
 * Extract color palette from node tree
 */
function extractColorPalette(node: FigmaNode): ComponentStylesResponse['colors'] {
    const colorMap = new Map<string, { usage: Set<string>; count: number }>();

    function addColor(color: string, usage: string) {
        if (!colorMap.has(color)) {
            colorMap.set(color, { usage: new Set([usage]), count: 0 });
        }
        const entry = colorMap.get(color)!;
        entry.usage.add(usage);
        entry.count++;
    }

    function traverse(n: FigmaNode) {
        // Background colors
        if ('backgroundColor' in n && n.backgroundColor) {
            addColor(figmaColorToHex(n.backgroundColor), 'background');
        }

        // Fills
        if ('fills' in n && n.fills && Array.isArray(n.fills)) {
            const fills = n.fills as Paint[];
            for (const fill of fills) {
                if (fill.type === 'SOLID' && fill.color) {
                    const isText = n.type === 'TEXT';
                    addColor(figmaColorToHex(fill.color), isText ? 'text' : 'fill');
                }
            }
        }

        // Strokes
        if ('strokes' in n && n.strokes && Array.isArray(n.strokes)) {
            const strokes = n.strokes as Paint[];
            for (const stroke of strokes) {
                if (stroke.type === 'SOLID' && stroke.color) {
                    addColor(figmaColorToHex(stroke.color), 'stroke');
                }
            }
        }

        // Effects (shadows)
        if ('effects' in n && (n as any).effects && Array.isArray((n as any).effects)) {
            const effects = (n as any).effects as Effect[];
            for (const effect of effects) {
                if (effect.color) {
                    addColor(figmaColorToHex(effect.color), 'shadow');
                }
            }
        }

        // Traverse children
        if ('children' in n && n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);

    return Array.from(colorMap.entries())
        .map(([color, data]) => ({
            value: color,
            usage: Array.from(data.usage).join(', '),
            count: data.count,
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Extract font information from node tree
 */
function extractFonts(node: FigmaNode): ComponentStylesResponse['fonts'] {
    const fontMap = new Map<string, { weight: number; size: number; count: number }>();

    function traverse(n: FigmaNode) {
        if (n.type === 'TEXT' && 'style' in n) {
            const textNode = n as any;
            const style = textNode.style as TypeStyle | undefined;

            if (style) {
                const key = `${style.fontFamily}:${style.fontWeight}:${style.fontSize}`;
                if (!fontMap.has(key)) {
                    fontMap.set(key, {
                        weight: style.fontWeight,
                        size: style.fontSize,
                        count: 0,
                    });
                }
                fontMap.get(key)!.count++;
            }
        }

        if ('children' in n && n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }

    traverse(node);

    return Array.from(fontMap.entries())
        .map(([key, data]) => {
            const [family, weight, size] = key.split(':');
            return {
                family,
                weight: data.weight,
                size: data.size,
                usage: inferTypographyUsage(data.size),
                count: data.count,
            };
        })
        .sort((a, b) => b.count - a.count);
}

/**
 * Convert Figma color to hex string
 */
function figmaColorToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a;

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    if (a < 1) {
        const alpha = Math.round(a * 255).toString(16).padStart(2, '0');
        return `${hex}${alpha}`;
    }

    return hex;
}

/**
 * Format line height from TypeStyle
 */
function formatLineHeight(style: TypeStyle): string {
    if (style.lineHeightUnit === 'PIXELS') {
        if (typeof style.lineHeightPx === 'number') {
            return `${style.lineHeightPx}px`;
        }
    } else if (style.lineHeightUnit === 'PERCENT') {
        if (typeof style.lineHeightPercent === 'number') {
            return `${style.lineHeightPercent}%`;
        }
    } else if (style.lineHeightUnit === 'AUTO') {
        // Figma's AUTO line height: let the consumer know it's automatic
        return 'AUTO';
    }

    // Fallback: try to use any available numeric value, otherwise return empty string
    if (typeof style.lineHeightPx === 'number') {
        return `${style.lineHeightPx}px`;
    }
    if (typeof style.lineHeightPercent === 'number') {
        return `${style.lineHeightPercent}%`;
    }
    return '';
}

/**
 * Infer typography usage from font size
 */
function inferTypographyUsage(size: number): string {
    if (size >= 32) return 'heading-1';
    if (size >= 24) return 'heading-2';
    if (size >= 20) return 'heading-3';
    if (size >= 16) return 'body';
    if (size >= 14) return 'body-small';
    return 'caption';
}
