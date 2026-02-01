/**
 * Style Mapper
 * Extracts design intent from Figma styling properties
 * 
 * Focuses on typography, spacing, colors, and Auto Layout translation
 */

import {
    FigmaNode,
    TextNode,
    FrameNode,
    Paint,
    FigmaColor,
    TypeStyle,
    Effect,
} from '../types/figma-api.js';
import {
    TypographyIntent,
    FlexboxRules,
} from '../types/normalized.js';
import { Color, FontWeight, TextAlign } from '../types/figma-base.js';
import { TypographyValue, SpacingValue, ShadowValue } from '../types/figma.js';

/**
 * Extract typography intent from text node
 * 
 * @param node - Figma text node
 * @returns Typography intent with semantic level detection
 */
export function extractTypography(node: TextNode): TypographyIntent {
    const style = node.style;

    if (!style) {
        return createDefaultTypography();
    }

    const typography: TypographyIntent = {
        fontFamily: style.fontFamily ?? 'sans-serif',
        fontSize: style.fontSize ?? 14,
        fontWeight: normalizeFontWeight(style.fontWeight ?? 400),
        lineHeight: style.lineHeightPx ?? 20,
        letterSpacing: style.letterSpacing ?? 0,
        textAlign: normalizeTextAlign(style.textAlignHorizontal ?? 'LEFT'),
        semanticLevel: detectSemanticLevel(style.fontSize ?? 14, style.fontWeight ?? 400),
    };

    return typography;
}

/**
 * Create default typography values
 */
function createDefaultTypography(): TypographyIntent {
    return {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 20,
        letterSpacing: 0,
        textAlign: 'LEFT',
    };
}

/**
 * Normalize font weight to standard values
 */
function normalizeFontWeight(weight: number): FontWeight {
    // Round to nearest 100
    const rounded = Math.round(weight / 100) * 100;
    const clamped = Math.max(100, Math.min(900, rounded));
    return clamped as FontWeight;
}

/**
 * Normalize text alignment
 */
function normalizeTextAlign(align: string): TextAlign {
    const alignMap: Record<string, TextAlign> = {
        'LEFT': 'LEFT',
        'CENTER': 'CENTER',
        'RIGHT': 'RIGHT',
        'JUSTIFIED': 'JUSTIFIED',
    };
    return alignMap[align] || 'LEFT';
}

/**
 * Detect semantic typography level (h1-h6, body, caption, etc.)
 * Based on font size and weight heuristics
 */
function detectSemanticLevel(
    fontSize: number,
    fontWeight: number
): TypographyIntent['semanticLevel'] {
    // Heuristic-based detection
    if (fontSize >= 32 && fontWeight >= 600) return 'h1';
    if (fontSize >= 28 && fontWeight >= 600) return 'h2';
    if (fontSize >= 24 && fontWeight >= 600) return 'h3';
    if (fontSize >= 20 && fontWeight >= 600) return 'h4';
    if (fontSize >= 18 && fontWeight >= 600) return 'h5';
    if (fontSize >= 16 && fontWeight >= 600) return 'h6';
    if (fontSize >= 16) return 'body';
    if (fontSize >= 12) return 'caption';
    return 'label';
}

/**
 * Extract spacing values from a layout node
 * Returns array of spacing values used (gaps, padding, margins)
 * 
 * @param node - Figma frame node with layout
 * @returns Array of spacing values in pixels
 */
export function extractSpacing(node: FrameNode): SpacingValue[] {
    const spacings: SpacingValue[] = [];

    // Item spacing (gap)
    if ((node as any).itemSpacing) {
        spacings.push((node as any).itemSpacing);
    }

    // Padding values
    const padding = extractPaddingValues(node);
    if (padding) {
        spacings.push(padding.top, padding.right, padding.bottom, padding.left);
    }

    // Remove duplicates and sort
    return [...new Set(spacings)].sort((a, b) => a - b);
}

/**
 * Extract padding values
 */
function extractPaddingValues(node: any): { top: number; right: number; bottom: number; left: number } | null {
    if (node.paddingTop !== undefined || node.paddingRight !== undefined ||
        node.paddingBottom !== undefined || node.paddingLeft !== undefined) {
        return {
            top: node.paddingTop || 0,
            right: node.paddingRight || 0,
            bottom: node.paddingBottom || 0,
            left: node.paddingLeft || 0,
        };
    }
    return null;
}

/**
 * Extract color intent from Figma paint
 * Returns RGBA color with semantic meaning preserved
 * 
 * @param paint - Figma paint object
 * @returns Color in RGBA format
 */
export function extractColorIntent(paint: Paint | undefined): Color | undefined {
    if (!paint || paint.type !== 'SOLID' || !paint.color) {
        return undefined;
    }

    const color = paint.color;
    return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: paint.opacity !== undefined ? paint.opacity * (color.a || 1) : (color.a || 1),
    };
}

/**
 * Extract color from Figma color object
 */
export function extractColor(color: FigmaColor | undefined): Color | undefined {
    if (!color) {
        return undefined;
    }

    return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a,
    };
}

/**
 * Translate Figma Auto Layout to CSS Flexbox rules
 * Core translation: layoutMode → flex-direction, alignments → justify/align
 * 
 * @param node - Figma frame with Auto Layout
 * @returns Flexbox rules for CSS implementation
 */
export function translateAutoLayoutToFlexbox(node: FrameNode): FlexboxRules | undefined {
    if (!node.layoutMode || node.layoutMode === 'NONE') {
        return undefined;
    }

    const direction = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    const justifyContent = mapPrimaryAxisAlignment(node);
    const alignItems = mapCounterAxisAlignment(node);
    const gap = (node as any).itemSpacing || 0;
    const padding = extractPaddingForFlexbox(node);

    return {
        direction,
        justifyContent,
        alignItems,
        gap,
        padding,
    };
}

/**
 * Map Figma primary axis alignment to CSS justify-content
 */
function mapPrimaryAxisAlignment(node: any): FlexboxRules['justifyContent'] {
    const align = node.primaryAxisAlignItems;

    const alignmentMap: Record<string, FlexboxRules['justifyContent']> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
        'SPACE_BETWEEN': 'space-between',
        'SPACE_AROUND': 'space-around',
        'SPACE_EVENLY': 'space-evenly',
    };

    return alignmentMap[align] || 'flex-start';
}

/**
 * Map Figma counter axis alignment to CSS align-items
 */
function mapCounterAxisAlignment(node: any): FlexboxRules['alignItems'] {
    const align = node.counterAxisAlignItems;

    const alignmentMap: Record<string, FlexboxRules['alignItems']> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
        'BASELINE': 'baseline',
    };

    return alignmentMap[align] || 'stretch';
}

/**
 * Extract padding for Flexbox rules
 */
function extractPaddingForFlexbox(node: any): FlexboxRules['padding'] | undefined {
    const paddingValues = extractPaddingValues(node);
    if (!paddingValues) {
        return undefined;
    }

    // Only return if at least one padding value is non-zero
    if (paddingValues.top === 0 && paddingValues.right === 0 &&
        paddingValues.bottom === 0 && paddingValues.left === 0) {
        return undefined;
    }

    return paddingValues;
}

/**
 * Extract shadow properties from effects
 * 
 * @param effects - Figma effects array
 * @returns Shadow value or undefined
 */
export function extractShadow(effects: Effect[] | undefined): ShadowValue | undefined {
    if (!effects || effects.length === 0) {
        return undefined;
    }

    const shadow = effects.find((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
    if (!shadow || !shadow.color) {
        return undefined;
    }

    return {
        offsetX: shadow.offset?.x || 0,
        offsetY: shadow.offset?.y || 0,
        blur: shadow.radius,
        spread: (shadow as any).spread ?? 0,
        color: {
            r: shadow.color.r,
            g: shadow.color.g,
            b: shadow.color.b,
            a: shadow.color.a,
        },
    };
}

/**
 * Convert RGBA color to hex string
 * Utility function for color transformation
 * 
 * @param rgba - RGBA color object
 * @returns Hex color string (e.g., "#FF5733")
 */
export function rgbaToHex(rgba: Color): string {
    const r = Math.round(rgba.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(rgba.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(rgba.b * 255).toString(16).padStart(2, '0');

    // Include alpha if not fully opaque
    if (rgba.a < 1) {
        const a = Math.round(rgba.a * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}${a}`.toUpperCase();
    }

    return `#${r}${g}${b}`.toUpperCase();
}

/**
 * Convert hex string to RGBA color
 * 
 * @param hex - Hex color string (e.g., "#FF5733" or "#FF5733AA")
 * @returns RGBA color object
 */
export function hexToRgba(hex: string): Color {
    // Remove # if present
    const cleanHex = hex.replace(/^#/, '');

    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    const a = cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) / 255 : 1;

    return { r, g, b, a };
}

/**
 * Check if two colors are approximately equal
 * Useful for color clustering and palette detection
 * 
 * @param color1 - First color
 * @param color2 - Second color
 * @param threshold - Difference threshold (default: 0.01)
 * @returns True if colors are approximately equal
 */
export function colorsEqual(color1: Color, color2: Color, threshold: number = 0.01): boolean {
    return (
        Math.abs(color1.r - color2.r) < threshold &&
        Math.abs(color1.g - color2.g) < threshold &&
        Math.abs(color1.b - color2.b) < threshold &&
        Math.abs(color1.a - color2.a) < threshold
    );
}

/**
 * Calculate perceived brightness of a color (0-1)
 * Based on relative luminance formula
 * 
 * @param color - RGBA color
 * @returns Brightness value (0 = black, 1 = white)
 */
export function calculateBrightness(color: Color): number {
    // Convert to linear RGB
    const linearize = (c: number) => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const r = linearize(color.r);
    const g = linearize(color.g);
    const b = linearize(color.b);

    // Calculate relative luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Determine if a color is "light" or "dark"
 * 
 * @param color - RGBA color
 * @returns True if light, false if dark
 */
export function isLightColor(color: Color): boolean {
    return calculateBrightness(color) > 0.5;
}

/**
 * Extract border radius values from a node
 * 
 * @param node - Figma node
 * @returns Border radius value in pixels
 */
export function extractBorderRadius(node: any): number {
    return node.cornerRadius || 0;
}

/**
 * Extract stroke (border) width from a node
 * 
 * @param node - Figma node
 * @returns Stroke width in pixels
 */
export function extractStrokeWidth(node: any): number {
    return node.strokeWeight || 0;
}
