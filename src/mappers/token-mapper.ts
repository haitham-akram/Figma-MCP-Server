/**
 * Token Mapper
 * Infers design tokens from normalized Figma nodes
 * 
 * Detects color palettes, typography scales, spacing systems, and other token patterns
 */

import { NormalizedNode, TypographyIntent } from '../types/normalized.js';
import { DesignToken, TokenCategory, TypographyValue } from '../types/figma.js';
import { Color } from '../types/figma-base.js';
import {
    extractTypography,
    extractSpacing,
    extractColorIntent,
    colorsEqual,
    calculateBrightness,
} from './style-mapper.js';

/**
 * Infer design tokens from a collection of normalized nodes
 * 
 * @param nodes - Array of normalized nodes
 * @returns Array of design tokens
 */
export function inferDesignTokens(nodes: NormalizedNode[]): DesignToken[] {
    const tokens: DesignToken[] = [];

    // Extract raw data from nodes
    const colors = extractColorsFromNodes(nodes);
    const typographies = extractTypographiesFromNodes(nodes);
    const spacings = extractSpacingsFromNodes(nodes);

    // Detect patterns and create tokens
    tokens.push(...detectColorPalette(colors));
    tokens.push(...detectTypographyScale(typographies));
    tokens.push(...detectSpacingSystem(spacings));

    return tokens;
}

/**
 * Extract all colors from nodes
 */
function extractColorsFromNodes(nodes: NormalizedNode[]): Color[] {
    const colors: Color[] = [];

    for (const node of nodes) {
        if (node.nodeType === 'text' && node.data.color) {
            colors.push(node.data.color);
        }
        if (node.nodeType === 'visual' && node.data.visual.backgroundColor) {
            colors.push(node.data.visual.backgroundColor);
        }
        if (node.nodeType === 'visual' && node.data.visual.border?.color) {
            colors.push(node.data.visual.border.color);
        }
    }

    return colors;
}

/**
 * Extract all typographies from nodes
 */
function extractTypographiesFromNodes(nodes: NormalizedNode[]): TypographyIntent[] {
    const typographies: TypographyIntent[] = [];

    for (const node of nodes) {
        if (node.nodeType === 'text') {
            typographies.push(node.data.typography);
        }
    }

    return typographies;
}

/**
 * Extract all spacing values from nodes
 */
function extractSpacingsFromNodes(nodes: NormalizedNode[]): number[] {
    const spacings: number[] = [];

    for (const node of nodes) {
        if (node.nodeType === 'layout' && node.data.flexbox) {
            if (node.data.flexbox.gap != null) {
                spacings.push(node.data.flexbox.gap);
            }
            if (node.data.flexbox.padding) {
                const p = node.data.flexbox.padding;
                spacings.push(p.top, p.right, p.bottom, p.left);
            }
        }
    }

    return spacings;
}

/**
 * Detect color palette from a collection of colors
 * Uses clustering to identify primary, secondary, neutral, and semantic colors
 * 
 * @param colors - Array of colors extracted from design
 * @returns Array of color tokens
 */
export function detectColorPalette(colors: Color[]): DesignToken[] {
    const tokens: DesignToken[] = [];

    if (colors.length === 0) {
        return tokens;
    }

    // Cluster similar colors
    const clusters = clusterColors(colors);

    // Sort clusters by frequency
    const sortedClusters = clusters.sort((a, b) => b.colors.length - a.colors.length);

    // Categorize clusters
    let primaryIndex = 0;
    let neutralIndex = 0;
    let semanticIndex = 0;

    for (const cluster of sortedClusters) {
        const representative = cluster.centroid;
        const brightness = calculateBrightness(representative);

        // Determine color category
        if (isNeutralColor(representative, brightness)) {
            // Neutral colors (grays, blacks, whites)
            const name = generateNeutralColorName(brightness, neutralIndex);
            tokens.push({
                name,
                category: 'color',
                value: representative,
                description: `Neutral color - brightness: ${(brightness * 100).toFixed(0)}%`,
                usage: `Used ${cluster.colors.length} times in design`,
            });
            neutralIndex++;
        } else if (isSemanticColor(representative)) {
            // Semantic colors (success, error, warning, info)
            const semanticType = detectSemanticColorType(representative);
            tokens.push({
                name: `${semanticType}-${semanticIndex}`,
                category: 'color',
                value: representative,
                description: `Semantic ${semanticType} color`,
                usage: `Used ${cluster.colors.length} times in design`,
            });
            semanticIndex++;
        } else {
            // Brand/primary colors
            const name = primaryIndex === 0 ? 'primary' : `primary-${primaryIndex}`;
            tokens.push({
                name,
                category: 'color',
                value: representative,
                description: `Primary brand color`,
                usage: `Used ${cluster.colors.length} times in design`,
            });
            primaryIndex++;
        }
    }

    return tokens;
}

/**
 * Cluster colors by similarity
 */
interface ColorCluster {
    centroid: Color;
    colors: Color[];
}

function clusterColors(colors: Color[], threshold: number = 0.1): ColorCluster[] {
    const clusters: ColorCluster[] = [];

    for (const color of colors) {
        // Find existing cluster
        let foundCluster = false;

        for (const cluster of clusters) {
            if (colorsEqual(color, cluster.centroid, threshold)) {
                cluster.colors.push(color);
                // Update centroid (average)
                cluster.centroid = averageColors([...cluster.colors]);
                foundCluster = true;
                break;
            }
        }

        // Create new cluster if no match found
        if (!foundCluster) {
            clusters.push({
                centroid: color,
                colors: [color],
            });
        }
    }

    return clusters;
}

/**
 * Average multiple colors
 */
function averageColors(colors: Color[]): Color {
    const sum = colors.reduce(
        (acc, c) => ({
            r: acc.r + c.r,
            g: acc.g + c.g,
            b: acc.b + c.b,
            a: acc.a + c.a,
        }),
        { r: 0, g: 0, b: 0, a: 0 }
    );

    const count = colors.length;
    return {
        r: sum.r / count,
        g: sum.g / count,
        b: sum.b / count,
        a: sum.a / count,
    };
}

/**
 * Check if color is neutral (grayscale)
 */
function isNeutralColor(color: Color, brightness: number): boolean {
    // Check if RGB values are similar (grayscale)
    const diff = Math.max(
        Math.abs(color.r - color.g),
        Math.abs(color.g - color.b),
        Math.abs(color.b - color.r)
    );
    return diff < 0.05;
}

/**
 * Generate neutral color name based on brightness
 */
function generateNeutralColorName(brightness: number, index: number): string {
    if (brightness > 0.95) return `white${index > 0 ? `-${index}` : ''}`;
    if (brightness < 0.05) return `black${index > 0 ? `-${index}` : ''}`;

    // Gray scale from 100 (lightest) to 900 (darkest)
    const scale = 900 - Math.round(brightness * 800);
    return `gray-${scale}`;
}

/**
 * Check if color is semantic (success, error, warning, info)
 */
function isSemanticColor(color: Color): boolean {
    // Simple heuristics for semantic colors
    const { r, g, b } = color;

    // Red-ish (error)
    if (r > 0.7 && g < 0.4 && b < 0.4) return true;

    // Green-ish (success)
    if (g > 0.6 && r < 0.4 && b < 0.4) return true;

    // Yellow/Orange-ish (warning)
    if (r > 0.7 && g > 0.5 && b < 0.3) return true;

    // Blue-ish (info)
    if (b > 0.6 && r < 0.4 && g < 0.6) return true;

    return false;
}

/**
 * Detect semantic color type
 */
function detectSemanticColorType(color: Color): string {
    const { r, g, b } = color;

    if (r > 0.7 && g < 0.4 && b < 0.4) return 'error';
    if (g > 0.6 && r < 0.4 && b < 0.4) return 'success';
    if (r > 0.7 && g > 0.5 && b < 0.3) return 'warning';
    if (b > 0.6 && r < 0.4 && g < 0.6) return 'info';

    return 'semantic';
}

/**
 * Detect typography scale from typographies
 * Identifies heading levels, body text, captions, etc.
 * 
 * @param typographies - Array of typography intents
 * @returns Array of typography tokens
 */
export function detectTypographyScale(typographies: TypographyIntent[]): DesignToken[] {
    const tokens: DesignToken[] = [];

    if (typographies.length === 0) {
        return tokens;
    }

    // Cluster by font size
    const sizeGroups = new Map<number, TypographyIntent[]>();

    for (const typo of typographies) {
        const roundedSize = Math.round(typo.fontSize);
        const group = sizeGroups.get(roundedSize) || [];
        group.push(typo);
        sizeGroups.set(roundedSize, group);
    }

    // Sort by size descending
    const sortedSizes = Array.from(sizeGroups.keys()).sort((a, b) => b - a);

    // Assign semantic levels
    sortedSizes.forEach((size, index) => {
        const group = sizeGroups.get(size)!;
        const representative = group[0];

        // Determine semantic name
        let name: string;
        let description: string;

        if (representative.semanticLevel) {
            name = representative.semanticLevel;
            description = `${representative.semanticLevel.toUpperCase()} text style`;
        } else if (index < 6) {
            name = `h${index + 1}`;
            description = `Heading level ${index + 1}`;
        } else if (size >= 14) {
            name = `body-${index - 5}`;
            description = 'Body text style';
        } else {
            name = `caption-${index - 5}`;
            description = 'Caption/small text style';
        }

        const value: TypographyValue = {
            fontFamily: representative.fontFamily,
            fontSize: representative.fontSize,
            fontWeight: representative.fontWeight,
            lineHeight: representative.lineHeight,
            letterSpacing: representative.letterSpacing,
            textAlign: representative.textAlign,
        };

        tokens.push({
            name,
            category: 'typography',
            value,
            description,
            usage: `Font size: ${size}px, used ${group.length} times`,
        });
    });

    return tokens;
}

/**
 * Detect spacing system from spacing values
 * Identifies base unit and scale (4px, 8px, 16px, etc.)
 * 
 * @param spacings - Array of spacing values
 * @returns Array of spacing tokens
 */
export function detectSpacingSystem(spacings: number[]): DesignToken[] {
    const tokens: DesignToken[] = [];

    if (spacings.length === 0) {
        return tokens;
    }

    // Remove zeros and filter unique values
    const uniqueSpacings = [...new Set(spacings.filter((s) => s > 0))].sort((a, b) => a - b);

    if (uniqueSpacings.length === 0) {
        return tokens;
    }

    // Detect base unit (GCD of all spacings)
    const baseUnit = findGCD(uniqueSpacings);

    // Generate scale
    const scale = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];

    uniqueSpacings.forEach((spacing, index) => {
        const multiplier = Math.round(spacing / baseUnit);
        const scaleName = index < scale.length ? scale[index] : `${index}`;

        tokens.push({
            name: `spacing-${scaleName}`,
            category: 'spacing',
            value: spacing,
            description: `${multiplier}x base unit (${baseUnit}px)`,
            usage: 'Used for margins, padding, and gaps',
        });
    });

    return tokens;
}

/**
 * Find greatest common divisor of numbers
 */
function findGCD(numbers: number[]): number {
    const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b);
    };

    return numbers.reduce((acc, num) => gcd(acc, Math.round(num)));
}

/**
 * Detect border radius tokens
 * 
 * @param borderRadii - Array of border radius values
 * @returns Array of border radius tokens
 */
export function detectBorderRadiusTokens(borderRadii: number[]): DesignToken[] {
    const tokens: DesignToken[] = [];

    const uniqueRadii = [...new Set(borderRadii.filter((r) => r > 0))].sort((a, b) => a - b);

    const scale = ['none', 'sm', 'md', 'lg', 'xl', 'full'];

    uniqueRadii.forEach((radius, index) => {
        const scaleName = index === 0 ? 'sm' : index < scale.length ? scale[index] : `${index}`;

        tokens.push({
            name: `radius-${scaleName}`,
            category: 'borderRadius',
            value: radius,
            description: `Border radius: ${radius}px`,
        });
    });

    return tokens;
}
