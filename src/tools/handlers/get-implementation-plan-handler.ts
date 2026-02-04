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
import { FigmaNode, ComponentNode, ComponentSetNode, InstanceNode, FrameNode } from '../../types/figma-api.js';
import { DesignToken } from '../../types/figma.js';
import { NormalizedNode } from '../../types/normalized.js';
import { normalizeNode } from '../../mappers/node-mapper.js';
import { inferDesignTokens } from '../../mappers/token-mapper.js';
import { handleGetFrameMap } from './get-frame-map-handler.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

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

    const cacheManager = getCacheManager();
    const cacheKey = CacheManager.planKey(fileKey, version, { targetFramework, pageId, componentIds });

    if (cacheManager) {
        const cached = await cacheManager.get<ImplementationPlanResponse>(cacheKey);
        if (cached) {
            console.error(`[Cache] Found processed implementation plan for ${fileKey}`);
            return cached;
        }
    }

    // Fetch file data from Figma API
    const fileData = await figmaClient.getFile(fileKey, { version });

    // Traverse and normalize all nodes
    const normalizedNodes = traverseAndNormalize(fileData.document);

    // Create node lookup map
    const nodeMap = createNodeMap(normalizedNodes);

    // Infer design tokens
    const tokens = inferDesignTokens(normalizedNodes);

    // Try frames first, then components
    let allFrames = traverseForFrames(fileData.document);
    let allComponents = traverseForComponents(fileData.document);

    // Decide which to use: frames if available, otherwise components
    const useFrames = allFrames.length > 0;

    console.error(`Implementation plan using: ${useFrames ? 'FRAMES' : 'COMPONENTS'} (frames: ${allFrames.length}, components: ${allComponents.length})`);

    // Apply filters and processing
    let filteredElements: Array<ComponentNode | ComponentSetNode | InstanceNode | FrameNode>;

    if (useFrames) {
        filteredElements = allFrames;

        if (pageId) {
            filteredElements = filteredElements.filter((elem) =>
                isNodeInPage(elem, pageId, fileData.document)
            );
        }

        if (componentIds && componentIds.length > 0) {
            filteredElements = filteredElements.filter((elem) =>
                componentIds.includes(elem.id)
            );
        }
    } else {
        filteredElements = allComponents;

        if (pageId) {
            filteredElements = filteredElements.filter((comp) =>
                isComponentInPage(comp as ComponentNode | ComponentSetNode | InstanceNode, pageId, fileData.document)
            );
        }

        if (componentIds && componentIds.length > 0) {
            filteredElements = filteredElements.filter((comp) =>
                componentIds.includes(comp.id)
            );
        }
    }

    // Generate framework-agnostic implementation steps
    const steps = generateImplementationSteps(filteredElements, tokens, useFrames);

    // Generate component mappings with layout strategy
    const componentMappings = generateComponentMappings(
        filteredElements,
        normalizedNodes,
        nodeMap,
        tokens,
        useFrames
    );

    // Analyze layout patterns across all components
    const layoutGuidance = analyzeLayoutPatterns(componentMappings);

    // Generate styling guidance based on tokens
    const stylingGuidance = generateStylingGuidance(tokens, normalizedNodes);

    // Generate open questions for developer consideration
    const openQuestions = generateOpenQuestions(componentMappings, tokens);

    // Identify implementation risks
    const risks = identifyRisks(componentMappings, normalizedNodes, tokens);

    // Generate summary notes
    const notes = generateSummaryNotes(
        filteredElements.length,
        tokens.length,
        layoutGuidance,
        stylingGuidance,
        targetFramework,
        useFrames
    );

    const response: ImplementationPlanResponse = {
        steps,
        componentMappings,
        layoutGuidance,
        stylingGuidance,
        openQuestions,
        risks,
        notes,
    };

    // Cache the processed plan
    if (cacheManager) {
        await cacheManager.set(cacheKey, response, 'plan');
    }

    return response;
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
 * Traverse for frame nodes
 */
function traverseForFrames(root: FigmaNode): FrameNode[] {
    const frames: FrameNode[] = [];
    const queue: FigmaNode[] = [root];

    while (queue.length > 0) {
        const node = queue.shift()!;

        if (node.type === 'FRAME') {
            frames.push(node as FrameNode);
        }

        if ('children' in node && node.children) {
            queue.push(...node.children);
        }
    }

    return frames;
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
 * Check if node belongs to specific page
 */
function isNodeInPage(
    node: FigmaNode,
    pageId: string,
    root: FigmaNode
): boolean {
    // Traverse up to find parent page (CANVAS node)
    const queue: FigmaNode[] = [root];

    while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.id === node.id) {
            // Found node, now check if ancestor is the target page
            return isAncestorPage(current, pageId, root);
        }

        if ('children' in current && current.children) {
            queue.push(...current.children);
        }
    }

    return false;
}

/**
 * Check if component belongs to specific page
 */
function isComponentInPage(
    component: ComponentNode | ComponentSetNode | InstanceNode,
    pageId: string,
    root: FigmaNode
): boolean {
    return isNodeInPage(component, pageId, root);
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
    elements: Array<ComponentNode | ComponentSetNode | InstanceNode | FrameNode>,
    tokens: DesignToken[],
    useFrames: boolean = false
): ImplementationStep[] {
    const steps: ImplementationStep[] = [];
    const elementType = useFrames ? 'frame' : 'component';
    const elementTypePlural = useFrames ? 'frames' : 'components';

    // Step 1: Analyze design system
    steps.push({
        stepNumber: 1,
        title: 'Analyze design system foundations',
        description: `Review the ${tokens.length} design tokens to understand the design language. Identify color palettes, typography scales, spacing systems, and other primitives. This forms the foundation for all ${elementTypePlural}.`,
        relatedTokens: tokens.slice(0, 15).map((t) => t.name),
    });

    // Step 2: Establish element hierarchy
    const componentCount = useFrames
        ? elements.filter((c) => c.type === 'FRAME').length
        : elements.filter((c) => c.type === 'COMPONENT').length;
    const componentSetCount = useFrames
        ? 0
        : elements.filter((c) => c.type === 'COMPONENT_SET').length;
    const instanceCount = useFrames
        ? 0
        : elements.filter((c) => c.type === 'INSTANCE').length;

    steps.push({
        stepNumber: 2,
        title: `Establish ${elementType} hierarchy`,
        description: useFrames
            ? `Map out frame relationships: ${componentCount} frames to implement. Identify top-level frames vs. nested frames.`
            : `Map out component relationships: ${componentCount} base components, ${componentSetCount} component sets (with variants), ${instanceCount} instances. Identify atomic components (buttons, inputs) vs. composite components (forms, cards).`,
        relatedComponents: elements.slice(0, 10).map((c) => c.id),
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
        relatedComponents: elements.filter((c) => c.type === 'COMPONENT' || c.type === 'FRAME').slice(0, 5).map((c) => c.id),
    });

    // Step 6: Handle variants
    if (componentSetCount > 0) {
        steps.push({
            stepNumber: 6,
            title: 'Implement variant systems',
            description: `${componentSetCount} component sets detected with multiple variants. Design a variant system that supports size, state, theme, and custom variations. Ensure variant props are type-safe and well-documented.`,
            relatedComponents: useFrames ? [] : elements.filter((c) => c.type === 'COMPONENT_SET').slice(0, 5).map((c) => c.id),
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
    elements: Array<ComponentNode | ComponentSetNode | InstanceNode | FrameNode>,
    normalizedNodes: NormalizedNode[],
    nodeMap: Map<string, NormalizedNode>,
    tokens: DesignToken[],
    useFrames: boolean = false
): ComponentMapping[] {
    return elements.map((element) => {
        const suggestedCodeName = toPascalCase(element.name);
        const suggestedFilePath = generateGenericFilePath(element.name);

        // Extract layout strategy from normalized node
        const normalizedNode = nodeMap.get(element.id);
        const layoutStrategy = extractLayoutStrategy(normalizedNode);

        // Analyze styling approach
        const stylingApproach = analyzeStylingApproach(element, tokens, normalizedNode);

        // Extract detailed visual styles
        const visualStyles = extractVisualStyles(element);

        // Calculate complexity score
        const complexityScore = calculateComplexityScore(element, normalizedNode);

        // Infer props (generic, not framework-specific)
        const props = inferGenericProps(element);

        // Find related tokens
        const relatedTokens = findRelatedTokens(element, tokens);

        return {
            componentId: element.id,
            componentName: element.name,
            suggestedCodeName,
            suggestedFilePath,
            layoutStrategy,
            stylingApproach,
            visualStyles,
            complexityScore,
            props,
            relatedTokens,
            notes: `Element type: ${element.type}. ${'description' in element && element.description
                ? `Description: ${element.description}`
                : ''
                }`,
        };
    });
}

/**
 * Analyze layout patterns across all components
 */
function analyzeLayoutPatterns(
    componentMappings: ComponentMapping[]
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
    elementCount: number,
    tokenCount: number,
    layoutGuidance: ImplementationPlanResponse['layoutGuidance'],
    stylingGuidance: ImplementationPlanResponse['stylingGuidance'],
    targetFramework?: string,
    useFrames: boolean = false
): string {
    const elementType = useFrames ? 'frames' : 'components';
    const frameworkNote = targetFramework
        ? ` Target framework: ${targetFramework} (adapt patterns as needed).`
        : ' Framework-agnostic plan - adapt to your chosen framework.';

    return `Implementation plan generated for ${elementCount} ${elementType} with ${tokenCount} design tokens.${frameworkNote}

Primary layout strategy: ${layoutGuidance.primaryStrategy}
Token coverage: ${stylingGuidance.tokenCoverage.colors} colors, ${stylingGuidance.tokenCoverage.typography} typography, ${stylingGuidance.tokenCoverage.spacing} spacing

Focus areas:
1. ${useFrames ? 'Frame' : 'Component'} breakdown by complexity and dependencies
2. Suggested folder structure (primitives, patterns, compositions)
3. Layout strategy per ${useFrames ? 'frame' : 'component'} (flexbox, grid, absolute, none)
4. Styling strategy with token usage recommendations
5. Open questions requiring developer decisions
6. Implementation risks with mitigation strategies

Next steps: Review open questions, address high-severity risks, and begin with base ${elementType}.`;
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
    element: ComponentNode | ComponentSetNode | InstanceNode | FrameNode,
    tokens: DesignToken[],
    node?: NormalizedNode
): ComponentMapping['stylingApproach'] {
    const recommendations: string[] = [];
    const tokenUsage: string[] = [];
    let complexityNotes: string | undefined;

    // Check for token usage
    const relatedColorTokens = tokens.filter(
        (t) => t.category === 'color' && element.name.toLowerCase().includes(t.name.toLowerCase())
    );
    const relatedSpacingTokens = tokens.filter(
        (t) => t.category === 'spacing' && element.name.toLowerCase().includes(t.name.toLowerCase())
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
    if (element.type === 'COMPONENT_SET') {
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
    element: ComponentNode | ComponentSetNode | InstanceNode | FrameNode,
    node?: NormalizedNode
): number {
    let score = 0;

    // Base complexity: element type
    if (element.type === 'COMPONENT') score += 2;
    if (element.type === 'COMPONENT_SET') score += 4;
    if (element.type === 'INSTANCE') score += 1;
    if (element.type === 'FRAME') score += 1;

    // Children complexity
    if ('children' in element && element.children) {
        const childCount = element.children.length;
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
    element: ComponentNode | ComponentSetNode | InstanceNode | FrameNode
): Array<{ name: string; type: string; description?: string; required: boolean }> {
    const props: Array<{ name: string; type: string; description?: string; required: boolean }> = [];

    // Children prop (generic)
    if ('children' in element && element.children && element.children.length > 0) {
        props.push({
            name: 'children',
            type: 'node',
            description: 'Child elements to render',
            required: false,
        });
    }

    // Variant prop for component sets
    if ('type' in element && element.type === 'COMPONENT_SET') {
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
    element: ComponentNode | ComponentSetNode | InstanceNode | FrameNode,
    tokens: DesignToken[]
): string[] {
    // Simple heuristic: match token names with element name
    const elementNameLower = element.name.toLowerCase();
    const relatedTokens = tokens
        .filter((token) => {
            const tokenNameLower = token.name.toLowerCase();
            // Match if token name contains element name segments
            const elementSegments = elementNameLower.split(/[\s\-_/]+/);
            return elementSegments.some((segment) => tokenNameLower.includes(segment));
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

/**
 * Extract detailed visual styles from element
 */
function extractVisualStyles(
    element: ComponentNode | ComponentSetNode | InstanceNode | FrameNode
): ComponentMapping['visualStyles'] {
    const colors: string[] = [];
    const fonts: Array<{ family: string; size: number; weight: number }> = [];
    let padding: string | undefined;
    let gap: number | undefined;
    let borderWidth: number | undefined;
    let borderRadius: number | undefined;
    let borderColor: string | undefined;
    const shadows: string[] = [];
    let hasImages = false;
    let hasVectors = false;
    let dimensions: { width: number; height: number } | undefined;
    let position: { x: number; y: number } | undefined;

    // Extract dimensions and position
    if ('absoluteBoundingBox' in element && element.absoluteBoundingBox) {
        const box = element.absoluteBoundingBox;
        dimensions = { width: box.width, height: box.height };
        position = { x: box.x, y: box.y };
    }

    // Extract colors from fills
    if ('fills' in element && element.fills && Array.isArray(element.fills)) {
        for (const fill of element.fills) {
            if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
                const hex = figmaColorToHex(fill.color);
                if (!colors.includes(hex)) colors.push(hex);
            } else if (fill.type === 'IMAGE') {
                hasImages = true;
            }
        }
    }

    // Background color
    if ('backgroundColor' in element && element.backgroundColor) {
        const hex = figmaColorToHex(element.backgroundColor);
        if (!colors.includes(hex)) colors.push(hex);
    }

    // Extract border info
    if ('strokes' in element && element.strokes && Array.isArray(element.strokes) && element.strokes.length > 0) {
        const stroke = element.strokes[0];
        if (stroke.color) {
            borderColor = figmaColorToHex(stroke.color);
        }
    }

    if ('strokeWeight' in element && element.strokeWeight != null) {
        borderWidth = element.strokeWeight;
    }

    if ('cornerRadius' in element && element.cornerRadius != null) {
        borderRadius = element.cornerRadius;
    }

    // Extract layout spacing
    if ('itemSpacing' in element && (element as any).itemSpacing != null) {
        gap = (element as any).itemSpacing;
    }

    if ('paddingTop' in element) {
        const el = element as any;
        padding = `${el.paddingTop || 0}px ${el.paddingRight || 0}px ${el.paddingBottom || 0}px ${el.paddingLeft || 0}px`;
    }

    // Extract effects (shadows)
    if ('effects' in element && (element as any).effects && Array.isArray((element as any).effects)) {
        const effects = (element as any).effects;
        for (const effect of effects) {
            if (effect.type === 'DROP_SHADOW' && effect.visible !== false) {
                const shadowStr = `${effect.offset?.x || 0}px ${effect.offset?.y || 0}px ${effect.radius}px ${effect.color ? figmaColorToHex(effect.color) : 'rgba(0,0,0,0.1)'}`;
                shadows.push(shadowStr);
            }
        }
    }

    // Extract text styles from children (including mixed styles)
    if ('children' in element && element.children) {
        const vectorTypes = ['VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'RECTANGLE'];

        for (const child of element.children) {
            // Check for vectors
            if (vectorTypes.includes(child.type)) {
                hasVectors = true;
            }

            if (child.type === 'TEXT' && 'style' in child) {
                const textNode = child as any;

                // Base text style
                if (textNode.style) {
                    const font = {
                        family: textNode.style.fontFamily,
                        size: textNode.style.fontSize,
                        weight: textNode.style.fontWeight,
                    };
                    if (!fonts.some(f => f.family === font.family && f.size === font.size && f.weight === font.weight)) {
                        fonts.push(font);
                    }
                }

                // Mixed text styles (different weights/sizes in same text)
                if (textNode.characterStyleOverrides && textNode.styleOverrideTable) {
                    const table = textNode.styleOverrideTable;
                    for (const key in table) {
                        const override = table[key];
                        if (override) {
                            const mixedFont = {
                                family: override.fontFamily || textNode.style?.fontFamily,
                                size: override.fontSize || textNode.style?.fontSize,
                                weight: override.fontWeight || textNode.style?.fontWeight,
                            };
                            if (!fonts.some(f => f.family === mixedFont.family && f.size === mixedFont.size && f.weight === mixedFont.weight)) {
                                fonts.push(mixedFont);
                            }
                        }
                    }
                }

                // Extract text colors
                if (textNode.fills && Array.isArray(textNode.fills)) {
                    for (const fill of textNode.fills) {
                        if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
                            const hex = figmaColorToHex(fill.color);
                            if (!colors.includes(hex)) colors.push(hex);
                        }
                    }
                }
            }
        }
    }

    return {
        colors,
        fonts,
        spacing: { padding, gap },
        borders: { width: borderWidth, radius: borderRadius, color: borderColor },
        shadows,
        hasImages,
        hasVectors,
        dimensions,
        position,
    };
}

/**
 * Convert Figma color to hex string
 */
function figmaColorToHex(color: any): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
