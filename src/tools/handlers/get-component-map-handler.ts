/**
 * Get Component Map Handler
 * Traverses document tree using BFS to collect components with hierarchy
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetComponentMapInput } from '../figma/get-component-map.js';
import { ComponentMapResponse, ComponentInfo, ComponentVariant } from '../../types/figma.js';
import {
    FigmaNode,
    ComponentNode,
    ComponentSetNode,
    InstanceNode,
} from '../../types/figma-api.js';
import { buildComponentHierarchy } from '../../mappers/node-mapper.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

/**
 * Maximum traversal depth (log warning beyond this)
 */
const MAX_TRAVERSAL_DEPTH = 12;

/**
 * Handle getComponentMap tool execution
 * Uses iterative BFS to traverse node tree
 * 
 * @param input - Tool input parameters
 * @param figmaClient - Figma API client instance
 * @returns Component map response with pagination
 */
export async function handleGetComponentMap(
    input: GetComponentMapInput,
    figmaClient: FigmaClient
): Promise<ComponentMapResponse> {
    const { fileKey, version, componentName, componentType, limit = 100, offset = 0 } = input;

    const cacheManager = getCacheManager();
    const cacheKey = CacheManager.componentsKey(fileKey, version);

    // Try to get processed components from cache
    let componentInfos: ComponentInfo[] | null = null;
    if (cacheManager) {
        componentInfos = await cacheManager.get<ComponentInfo[]>(cacheKey);
        if (componentInfos) {
            console.error(`[Cache] Found processed components for ${fileKey}`);
        }
    }

    // If not in cache, fetch and process
    if (!componentInfos) {
        // Fetch file data from Figma API
        const fileData = await figmaClient.getFile(fileKey, { version });

        // Collect all component nodes using BFS traversal
        const allComponents = traverseForComponents(fileData.document);

        // Build component hierarchy (parentId relationships)
        const hierarchy = buildComponentHierarchy([fileData.document]);

        // Map to ComponentInfo format
        componentInfos = allComponents.map((node) => {
            const parentId = hierarchy.get(node.id);
            const dimensions = node.absoluteBoundingBox
                ? { width: node.absoluteBoundingBox.width, height: node.absoluteBoundingBox.height }
                : { width: 0, height: 0 };

            // Extract variants (metadata-first, fallback to name parsing)
            const variants = extractVariants(node, fileData.components, fileData.componentSets);

            // Extract children IDs
            const childrenIds = 'children' in node && node.children
                ? node.children
                    .filter((child): child is ComponentNode | ComponentSetNode | InstanceNode =>
                        child.type === 'COMPONENT' || child.type === 'COMPONENT_SET' || child.type === 'INSTANCE'
                    )
                    .map((child) => child.id)
                : [];

            return {
                id: node.id,
                name: node.name,
                description: 'description' in node ? node.description : undefined,
                type: node.type as 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE',
                parentId,
                childrenIds,
                variants,
                dimensions,
            };
        });

        // Cache the processed components
        if (cacheManager) {
            await cacheManager.set(cacheKey, componentInfos, 'components');
        }
    }

    // Apply filters to the processed (cached or fresh) components
    let filteredComponents = componentInfos;

    if (componentName) {
        const lowerFilter = componentName.toLowerCase();
        filteredComponents = filteredComponents.filter((comp) =>
            comp.name.toLowerCase().includes(lowerFilter)
        );
    }

    if (componentType) {
        filteredComponents = filteredComponents.filter((comp) => comp.type === componentType);
    }

    // Calculate exact total count
    const totalCount = filteredComponents.length;

    // Apply pagination
    const paginatedComponents = filteredComponents.slice(offset, offset + limit);

    return {
        components: paginatedComponents,
        totalCount,
        hasMore: offset + paginatedComponents.length < totalCount,
    };
}

/**
 * Traverse document tree using iterative BFS to collect component nodes
 * Logs warning if depth exceeds safe threshold
 * 
 * @param root - Root node to start traversal
 * @returns Array of component nodes
 */
function traverseForComponents(
    root: FigmaNode
): Array<ComponentNode | ComponentSetNode | InstanceNode> {
    const components: Array<ComponentNode | ComponentSetNode | InstanceNode> = [];
    const queue: Array<{ node: FigmaNode; depth: number }> = [{ node: root, depth: 0 }];
    let maxDepthSeen = 0;
    const typeCounts: Record<string, number> = {};

    while (queue.length > 0) {
        const { node, depth } = queue.shift()!;

        // Track node types
        typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;

        // Track max depth
        if (depth > maxDepthSeen) {
            maxDepthSeen = depth;
        }

        // Log warning if exceeding safe threshold
        if (depth === MAX_TRAVERSAL_DEPTH) {
            console.warn(
                `Traversal depth reached ${MAX_TRAVERSAL_DEPTH} levels at node "${node.name}" (${node.id}). Consider limiting traversal if performance degrades.`
            );
        }

        // Collect component nodes
        if (
            node.type === 'COMPONENT' ||
            node.type === 'COMPONENT_SET' ||
            node.type === 'INSTANCE'
        ) {
            components.push(node as ComponentNode | ComponentSetNode | InstanceNode);
        }

        // Enqueue children (continue traversal even beyond warning depth)
        if ('children' in node && Array.isArray(node.children)) {
            for (const child of node.children) {
                queue.push({ node: child, depth: depth + 1 });
            }
        }
    }

    console.error(
        `Component traversal complete: found ${components.length} components, max depth: ${maxDepthSeen}`
    );
    if (components.length === 0) {
        console.error(`Node type distribution: ${JSON.stringify(typeCounts)}`);
    }

    return components;
}

/**
 * Extract component variants
 * Metadata-first approach with name parsing fallback
 * 
 * @param node - Component node
 * @param components - Component metadata from file
 * @param componentSets - Component set metadata from file
 * @returns Array of variant properties or undefined
 */
function extractVariants(
    node: ComponentNode | ComponentSetNode | InstanceNode,
    components?: Record<string, any>,
    componentSets?: Record<string, any>
): ComponentVariant[] | undefined {
    // For component sets, extract variants from metadata
    if (node.type === 'COMPONENT_SET' && componentSets) {
        const componentSetMeta = componentSets[node.id];
        if (componentSetMeta?.variantProperties) {
            return Object.entries(componentSetMeta.variantProperties).map(([prop, value]) => ({
                propertyName: prop,
                propertyValue: String(value),
            }));
        }
    }

    // For components and instances, check if they belong to a component set
    if ((node.type === 'COMPONENT' || node.type === 'INSTANCE') && components) {
        const componentMeta = components[node.id];
        const componentSetId = componentMeta?.componentSetId;

        if (componentSetId && componentSets) {
            const componentSet = componentSets[componentSetId];
            if (componentSet?.variantProperties) {
                return Object.entries(componentSet.variantProperties).map(([prop, value]) => ({
                    propertyName: prop,
                    propertyValue: String(value),
                }));
            }
        }
    }

    // Fallback: Parse component name for variant properties (e.g., "Button/Primary/Large")
    return parseVariantsFromName(node.name);
}

/**
 * Parse variant properties from component name
 * Fallback when metadata is not available
 * 
 * @param name - Component name
 * @returns Array of variant properties or undefined
 */
function parseVariantsFromName(name: string): ComponentVariant[] | undefined {
    // Split by "/" delimiter
    const segments = name.split('/').map((s) => s.trim());

    // Need at least base name + 1 variant to be meaningful
    if (segments.length < 2) {
        return undefined;
    }

    // First segment is typically the component base name
    // Remaining segments are variants
    const variants: ComponentVariant[] = [];

    // Common variant axes
    const variantAxes = ['state', 'size', 'variant', 'theme', 'type'];

    for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];

        // Infer property name from common patterns
        let propertyName = 'variant';

        // Check if segment matches common size values
        if (/^(xs|sm|small|md|medium|lg|large|xl|xxl)$/i.test(segment)) {
            propertyName = 'size';
        }
        // Check if segment matches common state values
        else if (/^(default|hover|active|disabled|focused|pressed)$/i.test(segment)) {
            propertyName = 'state';
        }
        // Check if segment matches common theme values
        else if (/^(light|dark|primary|secondary|success|error|warning|info)$/i.test(segment)) {
            propertyName = 'theme';
        }
        // Otherwise use sequential naming
        else if (i === 1) {
            propertyName = 'variant';
        } else {
            propertyName = `variant${i}`;
        }

        variants.push({
            propertyName,
            propertyValue: segment,
        });
    }

    return variants.length > 0 ? variants : undefined;
}
