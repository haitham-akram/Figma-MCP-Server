/**
 * Get Implementation Plan Handler
 * Generates framework-agnostic implementation guidance (PHASE 6)
 * 
 * Focus: Developer reasoning and structure, NOT code generation
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetImplementationPlanInput } from '../figma/get-implementation-plan.js';
import {
    ImplementationPlanResponse,
    ImplementationStep,
    ComponentMapping,
} from '../../types/figma.js';
import { FigmaNode, ComponentNode, ComponentSetNode, InstanceNode } from '../../types/figma-api.js';
import { DesignToken } from '../../types/figma.js';
import { NormalizedNode } from '../../types/normalized.js';
import { normalizeNode } from '../../mappers/node-mapper.js';
import { inferDesignTokens } from '../../mappers/token-mapper.js';

/**
 * Handle getImplementationPlan tool execution
 * 
 * @param input - Tool input parameters
 * @param figmaClient - Figma API client instance
 * @returns Framework-agnostic implementation plan
 */
export async function handleGetImplementationPlan(
    input: GetImplementationPlanInput,
    figmaClient: FigmaClient
): Promise<ImplementationPlanResponse> {
    const { fileKey, version, targetFramework, pageId, componentIds } = input;

    // Fetch file data from Figma API
    const fileData = await figmaClient.getFile(fileKey, { version });

    // Traverse and normalize all nodes
    const normalizedNodes = traverseAndNormalize(fileData.document);

    // Create node lookup map
    const nodeMap = createNodeMap(normalizedNodes);

    // Infer design tokens
    const tokens = inferDesignTokens(normalizedNodes);

    // Collect all component nodes
    const allComponents = traverseForComponents(fileData.document);

    // Apply filters
    let filteredComponents = allComponents;

    if (pageId) {
        filteredComponents = filteredComponents.filter((comp) =>
            isComponentInPage(comp, pageId, fileData.document)
        );
    }

    if (componentIds && componentIds.length > 0) {
        filteredComponents = filteredComponents.filter((comp) =>
            componentIds.includes(comp.id)
        );
    }

    // Generate framework-agnostic implementation steps
    const steps = generateImplementationSteps(filteredComponents, tokens);

    // Generate component mappings with layout strategy
    const componentMappings = generateComponentMappings(
        filteredComponents,
        normalizedNodes,
        nodeMap,
        tokens
    );

    // Analyze layout patterns across all components
    const layoutGuidance = analyzeLayoutPatterns(componentMappings, normalizedNodes);

    // Generate styling guidance based on tokens
    const stylingGuidance = generateStylingGuidance(tokens, normalizedNodes);

    // Generate open questions for developer consideration
    const openQuestions = generateOpenQuestions(componentMappings, tokens);

    // Identify implementation risks
    const risks = identifyRisks(componentMappings, normalizedNodes, tokens);

    // Generate summary notes
    const notes = generateSummaryNotes(
        filteredComponents.length,
        tokens.length,
        layoutGuidance,
        stylingGuidance,
        targetFramework
    );

    return {
        steps,
        componentMappings,
        layoutGuidance,
        stylingGuidance,
        openQuestions,
        risks,
        notes,
    };
}

/**
 * Traverse and normalize nodes
 */
function traverseAndNormalize(root: FigmaNode): NormalizedNode[] {
    const normalizedNodes: NormalizedNode[] = [];
    const queue: Array<{ node: FigmaNode; parentId?: string }> = [{ node: root }];

    while (queue.length > 0) {
        const { node, parentId } = queue.shift()!;

        const normalized = normalizeNode(node, parentId);
        if (normalized) {
            normalizedNodes.push(normalized);
        }

        if ('children' in node && node.children) {
            for (const child of node.children) {
                queue.push({ node: child, parentId: node.id });
            }
        }
    }

    return normalizedNodes;
}

/**
 * Create node lookup map
 */
function createNodeMap(nodes: NormalizedNode[]): Map<string, NormalizedNode> {
    const map = new Map<string, NormalizedNode>();
    for (const node of nodes) {
        map.set(node.id, node);
    }
    return map;
}

/**
 * Traverse for component nodes
 */
function traverseForComponents(
    root: FigmaNode
): Array<ComponentNode | ComponentSetNode | InstanceNode> {
    const components: Array<ComponentNode | ComponentSetNode | InstanceNode> = [];
    const queue: FigmaNode[] = [root];

    while (queue.length > 0) {
        const node = queue.shift()!;

        if (
            node.type === 'COMPONENT' ||
            node.type === 'COMPONENT_SET' ||
            node.type === 'INSTANCE'
        ) {
            components.push(node as ComponentNode | ComponentSetNode | InstanceNode);
        }

        if ('children' in node && node.children) {
            queue.push(...node.children);
        }
    }

    return components;
}

/**
 * Check if component belongs to specific page
 */
function isComponentInPage(
    component: ComponentNode | ComponentSetNode | InstanceNode,
    pageId: string,
    root: FigmaNode
): boolean {
    // Traverse up to find parent page (CANVAS node)
    const queue: FigmaNode[] = [root];

    while (queue.length > 0) {
        const node = queue.shift()!;

        if (node.id === component.id) {
            // Found component, now check if ancestor is the target page
            return isAncestorPage(node, pageId, root);
        }

        if ('children' in node && node.children) {
            queue.push(...node.children);
        }
    }

    return false;
}

/**
 * Check if page is ancestor of component
 */
function isAncestorPage(component: FigmaNode, pageId: string, root: FigmaNode): boolean {
    const queue: Array<{ node: FigmaNode; path: string[] }> = [{ node: root, path: [] }];

    while (queue.length > 0) {
        const { node, path } = queue.shift()!;

        if (node.id === component.id) {
            return path.includes(pageId);
        }

        if ('children' in node && node.children) {
            for (const child of node.children) {
                queue.push({ node: child, path: [...path, node.id] });
            }
        }
    }

    return false;
}

/**
 * Generate framework-agnostic implementation steps
 * Focus on structure and reasoning, not code
 */
function generateImplementationSteps(
    components: Array<ComponentNode | ComponentSetNode | InstanceNode>,
    tokens: DesignToken[]
): ImplementationStep[] {
    const steps: ImplementationStep[] = [];

    // Step 1: Analyze design system
    steps.push({
        stepNumber: 1,
        title: 'Analyze design system foundations',
        description: `Review the ${tokens.length} design tokens to understand the design language. Identify color palettes, typography scales, spacing systems, and other primitives. This forms the foundation for all components.`,
        relatedTokens: tokens.slice(0, 15).map((t) => t.name),
    });

    // Step 2: Establish component hierarchy
    const componentCount = components.filter((c) => c.type === 'COMPONENT').length;
    const componentSetCount = components.filter((c) => c.type === 'COMPONENT_SET').length;
    const instanceCount = components.filter((c) => c.type === 'INSTANCE').length;

    steps.push({
        stepNumber: 2,
        title: 'Establish component hierarchy',
        description: `Map out component relationships: ${componentCount} base components, ${componentSetCount} component sets (with variants), ${instanceCount} instances. Identify atomic components (buttons, inputs) vs. composite components (forms, cards).`,
        relatedComponents: components.slice(0, 10).map((c) => c.id),
    });

    // Step 3: Define folder structure
    steps.push({
        stepNumber: 3,
        title: 'Define folder structure',
        description: 'Organize components by category: primitives (buttons, inputs), layout (containers, grids), patterns (cards, modals), and compositions (forms, pages). Keep atomic components separate from composite ones.',
    });

    // Step 4: Implement layout system
    steps.push({
        stepNumber: 4,
        title: 'Implement layout system',
        description: 'Create layout primitives based on detected Figma Auto Layout patterns. Support flexbox-based layouts with proper spacing, alignment, and responsive behavior. Consider grid systems for 2D layouts.',
    });

    // Step 5: Build base components
    steps.push({
        stepNumber: 5,
        title: 'Build base components first',
        description: 'Start with the most primitive components (buttons, text inputs, icons). These have no dependencies and are used by all other components. Focus on API design (props/attributes) and token integration.',
        relatedComponents: components.filter((c) => c.type === 'COMPONENT').slice(0, 5).map((c) => c.id),
    });

    // Step 6: Handle variants
    if (componentSetCount > 0) {
        steps.push({
            stepNumber: 6,
            title: 'Implement variant systems',
            description: `${componentSetCount} component sets detected with multiple variants. Design a variant system that supports size, state, theme, and custom variations. Ensure variant props are type-safe and well-documented.`,
            relatedComponents: components.filter((c) => c.type === 'COMPONENT_SET').slice(0, 5).map((c) => c.id),
        });
    }

    // Step 7: Compose complex components
    steps.push({
        stepNumber: steps.length + 1,
        title: 'Compose complex components',
        description: 'Build composite components by combining base components. Examples: search bars (input + button), dropdown menus (button + list), modals (overlay + card + buttons).',
    });

    // Step 8: Test and document
    steps.push({
        stepNumber: steps.length + 1,
        title: 'Test and document',
        description: 'Write component tests covering props, variants, and accessibility. Document usage patterns, props, and examples. Consider visual regression testing for complex components.',
    });

    return steps;
}

/**
 * Generate component-to-code mappings with layout strategy
 */
function generateComponentMappings(
    components: Array<ComponentNode | ComponentSetNode | InstanceNode>,
    normalizedNodes: NormalizedNode[],
    nodeMap: Map<string, NormalizedNode>,
    tokens: DesignToken[]
): ComponentMapping[] {
    return components.map((component) => {
        const suggestedCodeName = toPascalCase(component.name);
        const suggestedFilePath = generateGenericFilePath(component.name);

        // Extract layout strategy from normalized node
        const normalizedNode = nodeMap.get(component.id);
        const layoutStrategy = extractLayoutStrategy(normalizedNode);

        // Analyze styling approach
        const stylingApproach = analyzeStylingApproach(component, tokens, normalizedNode);

        // Calculate complexity score
        const complexityScore = calculateComplexityScore(component, normalizedNode);

        // Infer props (generic, not framework-specific)
        const props = inferGenericProps(component);

        // Find related tokens
        const relatedTokens = findRelatedTokens(component, tokens);

        return {
            componentId: component.id,
            componentName: component.name,
            suggestedCodeName,
            suggestedFilePath,
            layoutStrategy,
            stylingApproach,
            complexityScore,
            props,
            relatedTokens,
            notes: `Component type: ${component.type}. ${'description' in component && component.description
                    ? `Description: ${component.description}`
                    : ''
                }`,
        };
    });
}

/**
 * Analyze layout patterns across all components
 */
function analyzeLayoutPatterns(
    componentMappings: ComponentMapping[],
    normalizedNodes: NormalizedNode[]
): ImplementationPlanResponse['layoutGuidance'] {
    const layoutCounts: Record<string, number> = {
        flexbox: 0,
        grid: 0,
        absolute: 0,
        none: 0,
    };

    const patterns: Array<{ pattern: string; occurrences: number; recommendation: string }> = [];

    // Count layout strategies
    for (const mapping of componentMappings) {
        layoutCounts[mapping.layoutStrategy.type]++;
    }

    // Determine primary strategy
    const sortedStrategies = Object.entries(layoutCounts).sort((a, b) => b[1] - a[1]);
    const primaryStrategy = sortedStrategies[0][0];

    // Generate patterns
    if (layoutCounts.flexbox > 0) {
        patterns.push({
            pattern: 'Flexbox layouts',
            occurrences: layoutCounts.flexbox,
            recommendation: 'Use CSS Flexbox or framework flex utilities. Most components use single-axis layouts with proper spacing and alignment.',
        });
    }

    if (layoutCounts.grid > 0) {
        patterns.push({
            pattern: '2D Grid layouts',
            occurrences: layoutCounts.grid,
            recommendation: 'Use CSS Grid for components with row/column structures. Consider responsive grid breakpoints.',
        });
    }

    if (layoutCounts.absolute > 0) {
        patterns.push({
            pattern: 'Absolute positioning',
            occurrences: layoutCounts.absolute,
            recommendation: 'Components use absolute positioning. Consider if this is necessary or if flexbox/grid could achieve the same layout more responsively.',
        });
    }

    const notes: string[] = [
        `Primary layout strategy: ${primaryStrategy}`,
        `${layoutCounts.flexbox + layoutCounts.grid} components use structured layouts`,
        'Implement a layout system with Container, Stack, and Grid primitives',
    ];

    if (layoutCounts.absolute > layoutCounts.flexbox + layoutCounts.grid) {
        notes.push('⚠️  Many components use absolute positioning - may cause responsive layout issues');
    }

    return {
        primaryStrategy: `${primaryStrategy} (${layoutCounts[primaryStrategy]} components)`,
        patterns,
        notes,
    };
}

/**
 * Generate styling guidance
 */
function generateStylingGuidance(
    tokens: DesignToken[],
    normalizedNodes: NormalizedNode[]
): ImplementationPlanResponse['stylingGuidance'] {
    const colorTokens = tokens.filter((t) => t.category === 'color').length;
    const typographyTokens = tokens.filter((t) => t.category === 'typography').length;
    const spacingTokens = tokens.filter((t) => t.category === 'spacing').length;

    const recommendations: string[] = [
        'Define design tokens as CSS custom properties, JavaScript constants, or design system primitives',
        'Use token-based styling throughout - avoid hard-coded values',
    ];

    const considerations: string[] = [];

    if (colorTokens > 20) {
        considerations.push(`Large color palette (${colorTokens} tokens) - consider consolidation or semantic grouping`);
    } else if (colorTokens > 0) {
        recommendations.push(`Apply ${colorTokens} color tokens consistently across components`);
    }

    if (typographyTokens > 0) {
        recommendations.push(`Implement ${typographyTokens} typography styles with proper font loading and fallbacks`);
    }

    if (spacingTokens > 0) {
        recommendations.push(`Use ${spacingTokens} spacing tokens for padding, margin, and gap values`);
    } else {
        considerations.push('No spacing system detected - consider defining consistent spacing scale');
    }

    // Check for components with visual complexity
    const visualNodes = normalizedNodes.filter((n) => n.nodeType === 'visual');
    if (visualNodes.length > 50) {
        considerations.push(`${visualNodes.length} visual elements - organize styles by component to avoid bloat`);
    }

    return {
        tokenCoverage: {
            colors: colorTokens,
            typography: typographyTokens,
            spacing: spacingTokens,
        },
        recommendations,
        considerations,
    };
}

/**
 * Generate open questions for developer consideration
 */
function generateOpenQuestions(
    componentMappings: ComponentMapping[],
    tokens: DesignToken[]
): ImplementationPlanResponse['openQuestions'] {
    const questions: ImplementationPlanResponse['openQuestions'] = [];

    // Responsive behavior questions
    const complexComponents = componentMappings.filter((m) => m.complexityScore >= 6);
    if (complexComponents.length > 0) {
        questions.push({
            question: 'How should complex components adapt to different screen sizes?',
            context: `${complexComponents.length} components have high complexity scores. Define responsive breakpoints and behavior.`,
            relatedComponents: complexComponents.slice(0, 5).map((c) => c.componentId),
        });
    }

    // Component sets question
    const componentSets = componentMappings.filter((m) =>
        m.componentName.includes('/')
    );
    if (componentSets.length > 0) {
        questions.push({
            question: 'How should variant selection be exposed in the API?',
            context: `${componentSets.length} components have variants. Decide between prop-based variants vs. separate components.`,
            relatedComponents: componentSets.slice(0, 3).map((c) => c.componentId),
        });
    }

    // Layout questions
    const gridComponents = componentMappings.filter(
        (m) => m.layoutStrategy.type === 'grid'
    );
    if (gridComponents.length > 0) {
        questions.push({
            question: 'How should grid layouts handle responsive column counts?',
            context: `${gridComponents.length} components use grid layouts. Define mobile, tablet, and desktop grid configurations.`,
            relatedComponents: gridComponents.slice(0, 3).map((c) => c.componentId),
        });
    }

    // Accessibility question
    questions.push({
        question: 'What accessibility features are required?',
        context: 'Consider ARIA labels, keyboard navigation, focus management, and screen reader support for all interactive components.',
    });

    // State management question
    const interactiveComponents = componentMappings.filter((m) =>
        m.componentName.toLowerCase().match(/button|input|select|modal|dropdown|menu/)
    );
    if (interactiveComponents.length > 0) {
        questions.push({
            question: 'How should component state be managed?',
            context: `${interactiveComponents.length} interactive components detected. Define controlled vs. uncontrolled patterns and state lifting strategies.`,
            relatedComponents: interactiveComponents.slice(0, 5).map((c) => c.componentId),
        });
    }

    // Token application question
    if (tokens.length > 30) {
        questions.push({
            question: 'How should design tokens be consumed by components?',
            context: `${tokens.length} design tokens detected. Choose between CSS custom properties, styled-components theme, or direct token imports.`,
        });
    }

    return questions;
}

/**
 * Identify implementation risks
 */
function identifyRisks(
    componentMappings: ComponentMapping[],
    normalizedNodes: NormalizedNode[],
    tokens: DesignToken[]
): ImplementationPlanResponse['risks'] {
    const risks: ImplementationPlanResponse['risks'] = [];

    // Deep nesting risk
    const deepComponents = componentMappings.filter((m) => m.complexityScore >= 8);
    if (deepComponents.length > 0) {
        risks.push({
            severity: 'medium',
            risk: `${deepComponents.length} highly complex components detected`,
            impact: 'Deep component hierarchies can cause performance issues and maintenance burden',
            mitigation: 'Break down complex components into smaller, reusable pieces. Use composition patterns.',
        });
    }

    // Excessive variants risk
    const highVariantComponents = componentMappings.filter((m) =>
        m.componentName.split('/').length > 3
    );
    if (highVariantComponents.length > 5) {
        risks.push({
            severity: 'medium',
            risk: `${highVariantComponents.length} components have excessive variant combinations`,
            impact: 'Too many variants increases API complexity and testing burden',
            mitigation: 'Consolidate similar variants. Use composition instead of explosion of variant props.',
        });
    }

    // Inconsistent patterns risk
    const layoutStrategies = new Set(componentMappings.map((m) => m.layoutStrategy.type));
    if (layoutStrategies.size > 2) {
        risks.push({
            severity: 'low',
            risk: 'Multiple layout strategies used across components',
            impact: 'Inconsistent layout approaches can lead to maintenance challenges',
            mitigation: 'Standardize on primary layout system (flexbox or grid). Document exceptions.',
        });
    }

    // Token coverage risk
    const colorTokens = tokens.filter((t) => t.category === 'color').length;
    if (colorTokens > 50) {
        risks.push({
            severity: 'medium',
            risk: `Large color palette (${colorTokens} color tokens)`,
            impact: 'Too many colors can lead to inconsistent UI and decision fatigue',
            mitigation: 'Audit color usage. Consolidate similar colors. Define semantic color roles.',
        });
    }

    // Missing spacing system risk
    const spacingTokens = tokens.filter((t) => t.category === 'spacing').length;
    if (spacingTokens === 0) {
        risks.push({
            severity: 'high',
            risk: 'No spacing system detected',
            impact: 'Without consistent spacing, components will have misaligned layouts and visual inconsistencies',
            mitigation: 'Define spacing scale (4px, 8px, 16px, etc.) and apply consistently across all components.',
        });
    }

    // Absolute positioning risk
    const absoluteComponents = componentMappings.filter(
        (m) => m.layoutStrategy.type === 'absolute'
    );
    if (absoluteComponents.length > componentMappings.length * 0.3) {
        risks.push({
            severity: 'high',
            risk: `${absoluteComponents.length} components use absolute positioning (${Math.round((absoluteComponents.length / componentMappings.length) * 100)}%)`,
            impact: 'Absolute positioning breaks responsive layouts and is hard to maintain',
            mitigation: 'Refactor to use flexbox or grid layouts. Reserve absolute positioning for specific use cases (tooltips, dropdowns).',
        });
    }

    return risks;
}

/**
 * Generate summary notes
 */
function generateSummaryNotes(
    componentCount: number,
    tokenCount: number,
    layoutGuidance: ImplementationPlanResponse['layoutGuidance'],
    stylingGuidance: ImplementationPlanResponse['stylingGuidance'],
    targetFramework?: string
): string {
    const frameworkNote = targetFramework
        ? ` Target framework: ${targetFramework} (adapt patterns as needed).`
        : ' Framework-agnostic plan - adapt to your chosen framework.';

    return `Implementation plan generated for ${componentCount} components with ${tokenCount} design tokens.${frameworkNote}

Primary layout strategy: ${layoutGuidance.primaryStrategy}
Token coverage: ${stylingGuidance.tokenCoverage.colors} colors, ${stylingGuidance.tokenCoverage.typography} typography, ${stylingGuidance.tokenCoverage.spacing} spacing

Focus areas:
1. Component breakdown by complexity and dependencies
2. Suggested folder structure (primitives, patterns, compositions)
3. Layout strategy per component (flexbox, grid, absolute, none)
4. Styling strategy with token usage recommendations
5. Open questions requiring developer decisions
6. Implementation risks with mitigation strategies

Next steps: Review open questions, address high-severity risks, and begin with base components.`;
}

// Helper functions

/**
 * Extract layout strategy from normalized node
 */
function extractLayoutStrategy(
    node?: NormalizedNode
): ComponentMapping['layoutStrategy'] {
    if (!node || node.nodeType !== 'layout') {
        return {
            type: 'none',
            reasoning: 'Component does not have explicit layout properties',
        };
    }

    const { data } = node;
    const strategy = data.strategy;

    if (strategy === 'flexbox' && data.flexbox) {
        return {
            type: 'flexbox',
            reasoning: `Uses Figma Auto Layout (${data.flexbox.direction} direction, ${data.flexbox.justifyContent} justify, ${data.flexbox.alignItems} align)`,
            details: {
                direction: data.flexbox.direction,
                justifyContent: data.flexbox.justifyContent,
                alignItems: data.flexbox.alignItems,
                gap: data.flexbox.gap,
                padding: data.flexbox.padding,
            },
        };
    }

    if (strategy === 'grid-candidate' && data.grid) {
        return {
            type: 'grid',
            reasoning: `Detected 2D grid pattern (${data.grid.columns}×${data.grid.rows})`,
            details: {
                columns: data.grid.columns,
                rows: data.grid.rows,
                columnGap: data.grid.columnGap,
                rowGap: data.grid.rowGap,
            },
        };
    }

    if (strategy === 'absolute') {
        return {
            type: 'absolute',
            reasoning: 'Uses absolute positioning - may require manual positioning logic',
        };
    }

    return {
        type: 'none',
        reasoning: 'No structured layout detected',
    };
}

/**
 * Analyze styling approach for component
 */
function analyzeStylingApproach(
    component: ComponentNode | ComponentSetNode | InstanceNode,
    tokens: DesignToken[],
    node?: NormalizedNode
): ComponentMapping['stylingApproach'] {
    const recommendations: string[] = [];
    const tokenUsage: string[] = [];
    let complexityNotes: string | undefined;

    // Check for token usage
    const relatedColorTokens = tokens.filter(
        (t) => t.category === 'color' && component.name.toLowerCase().includes(t.name.toLowerCase())
    );
    const relatedSpacingTokens = tokens.filter(
        (t) => t.category === 'spacing' && component.name.toLowerCase().includes(t.name.toLowerCase())
    );

    if (relatedColorTokens.length > 0) {
        tokenUsage.push(`Uses ${relatedColorTokens.length} color tokens`);
        recommendations.push('Apply color tokens via CSS custom properties or design system variables');
    }

    if (relatedSpacingTokens.length > 0) {
        tokenUsage.push(`Uses ${relatedSpacingTokens.length} spacing tokens`);
        recommendations.push('Use spacing tokens for padding, margin, and gap values');
    }

    // Check for variants
    if (component.type === 'COMPONENT_SET') {
        recommendations.push('Implement variant system for different states/sizes/themes');
        complexityNotes = 'Component set with multiple variants - requires state management';
    }

    // Check for visual complexity
    if (node && node.nodeType === 'visual') {
        const { visual } = node.data;
        if (visual.shadow) {
            recommendations.push('Component uses shadows - ensure shadow tokens are applied');
        }
        if (visual.border) {
            recommendations.push('Component has borders - use border tokens for consistency');
        }
    }

    // Default recommendations
    if (recommendations.length === 0) {
        recommendations.push('Apply design tokens for colors, spacing, and typography');
        recommendations.push('Consider CSS-in-JS, CSS modules, or utility classes based on your stack');
    }

    return {
        recommendations,
        tokenUsage,
        complexityNotes,
    };
}

/**
 * Calculate component complexity score (0-10)
 */
function calculateComplexityScore(
    component: ComponentNode | ComponentSetNode | InstanceNode,
    node?: NormalizedNode
): number {
    let score = 0;

    // Base complexity: component type
    if (component.type === 'COMPONENT') score += 2;
    if (component.type === 'COMPONENT_SET') score += 4;
    if (component.type === 'INSTANCE') score += 1;

    // Children complexity
    if ('children' in component && component.children) {
        const childCount = component.children.length;
        if (childCount > 10) score += 3;
        else if (childCount > 5) score += 2;
        else if (childCount > 2) score += 1;
    }

    // Layout complexity
    if (node && node.nodeType === 'layout') {
        if (node.data.strategy === 'flexbox') score += 1;
        if (node.data.strategy === 'grid-candidate') score += 2;
        if (node.data.strategy === 'absolute') score += 3;
    }

    // Cap at 10
    return Math.min(score, 10);
}

/**
 * Infer generic props (not framework-specific)
 */
function inferGenericProps(
    component: ComponentNode | ComponentSetNode | InstanceNode
): Array<{ name: string; type: string; description?: string; required: boolean }> {
    const props: Array<{ name: string; type: string; description?: string; required: boolean }> = [];

    // Children prop (generic)
    if ('children' in component && component.children && component.children.length > 0) {
        props.push({
            name: 'children',
            type: 'node',
            description: 'Child elements to render',
            required: false,
        });
    }

    // Variant prop for component sets
    if (component.type === 'COMPONENT_SET') {
        props.push({
            name: 'variant',
            type: 'string',
            description: 'Component variant (size, state, theme, etc.)',
            required: false,
        });
    }

    // Common UI props (generic)
    props.push(
        {
            name: 'className',
            type: 'string',
            description: 'Additional CSS class names',
            required: false,
        },
        {
            name: 'style',
            type: 'object',
            description: 'Inline style object',
            required: false,
        },
        {
            name: 'id',
            type: 'string',
            description: 'Element ID attribute',
            required: false,
        }
    );

    return props;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
    return str
        .split(/[\s\-_/]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Generate generic file path (no framework-specific extensions)
 */
function generateGenericFilePath(componentName: string): string {
    const kebabName = componentName
        .split(/[\s_/]+/)
        .join('-')
        .toLowerCase();

    return `components/${kebabName}/${toPascalCase(componentName)}`;
}

/**
 * Find design tokens related to component
 */
function findRelatedTokens(
    component: ComponentNode | ComponentSetNode | InstanceNode,
    tokens: DesignToken[]
): string[] {
    // Simple heuristic: match token names with component name
    const componentNameLower = component.name.toLowerCase();
    const relatedTokens = tokens
        .filter((token) => {
            const tokenNameLower = token.name.toLowerCase();
            // Match if token name contains component name segments
            const componentSegments = componentNameLower.split(/[\s\-_/]+/);
            return componentSegments.some((segment) => tokenNameLower.includes(segment));
        })
        .map((token) => token.name);

    // If no matches, return common tokens (colors, spacing)
    if (relatedTokens.length === 0) {
        return tokens
            .filter((t) => t.category === 'color' || t.category === 'spacing')
            .slice(0, 5)
            .map((t) => t.name);
    }

    return relatedTokens.slice(0, 10);
}
