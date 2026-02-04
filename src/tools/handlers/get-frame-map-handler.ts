/**
 * Get Frame Map Handler
 * Traverses document tree using BFS to collect frames with hierarchy
 */

import { FigmaClient } from '../../clients/figma-client.js';
import { GetFrameMapInput } from '../figma/get-frame-map.js';
import { FigmaNode, FrameNode } from '../../types/figma-api.js';
import { buildComponentHierarchy } from '../../mappers/node-mapper.js';
import { getCacheManager } from '../registry.js';
import { CacheManager } from '../../cache/cache-manager.js';

/**
 * Maximum traversal depth (log warning beyond this)
 */
const MAX_TRAVERSAL_DEPTH = 12;

/**
 * Frame info response
 */
export interface FrameInfo {
    id: string;
    name: string;
    type: 'FRAME';
    parentId?: string;
    childrenIds: string[];
    dimensions: {
        width: number;
        height: number;
    };
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
}

/**
 * Frame map response
 */
export interface FrameMapResponse {
    frames: FrameInfo[];
    totalCount: number;
    hasMore: boolean;
}

/**
 * Handle getFrameMap tool execution
 * Uses iterative BFS to traverse node tree
 */
export async function handleGetFrameMap(
    input: GetFrameMapInput,
    figmaClient: FigmaClient
): Promise<FrameMapResponse> {
    const { fileKey, version, frameName, limit = 100, offset = 0 } = input;

    const cacheManager = getCacheManager();
    const cacheKey = CacheManager.framesKey(fileKey, version);

    // Try to get processed frames from cache
    let frameInfos: FrameInfo[] | null = null;
    if (cacheManager) {
        frameInfos = await cacheManager.get<FrameInfo[]>(cacheKey);
        if (frameInfos) {
            console.error(`[Cache] Found processed frames for ${fileKey}`);
        }
    }

    // If not in cache, fetch and process
    if (!frameInfos) {
        // Fetch file data from Figma API
        const fileData = await figmaClient.getFile(fileKey, { version });

        // Collect all frame nodes using BFS traversal
        const allFrames = traverseForFrames(fileData.document);

        // Build hierarchy (parentId relationships)
        const hierarchy = buildComponentHierarchy([fileData.document]);

        // Map to FrameInfo format
        frameInfos = allFrames.map((node) => {
            const parentId = hierarchy.get(node.id);
            const dimensions = node.absoluteBoundingBox
                ? { width: node.absoluteBoundingBox.width, height: node.absoluteBoundingBox.height }
                : { width: 0, height: 0 };

            // Extract children IDs (only frames)
            const childrenIds = 'children' in node && node.children
                ? node.children
                    .filter((child): child is FrameNode => child.type === 'FRAME')
                    .map((child) => child.id)
                : [];

            return {
                id: node.id,
                name: node.name,
                type: 'FRAME',
                parentId,
                childrenIds,
                dimensions,
                layoutMode: node.layoutMode,
            };
        });

        // Cache the processed frames
        if (cacheManager) {
            await cacheManager.set(cacheKey, frameInfos, 'frames');
        }
    }

    // Apply filters to the processed (cached or fresh) frames
    let filteredFrames = frameInfos;

    if (frameName) {
        const lowerFilter = frameName.toLowerCase();
        filteredFrames = filteredFrames.filter((frame) =>
            frame.name.toLowerCase().includes(lowerFilter)
        );
    }

    // Calculate exact total count
    const totalCount = filteredFrames.length;

    // Apply pagination
    const paginatedFrames = filteredFrames.slice(offset, offset + limit);

    return {
        frames: paginatedFrames,
        totalCount,
        hasMore: offset + paginatedFrames.length < totalCount,
    };
}

/**
 * Traverse document tree using iterative BFS to collect frame nodes
 */
function traverseForFrames(root: FigmaNode): FrameNode[] {
    const frames: FrameNode[] = [];
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

        // Collect frame nodes
        if (node.type === 'FRAME') {
            frames.push(node as FrameNode);
        }

        // Enqueue children (continue traversal even beyond warning depth)
        if ('children' in node && Array.isArray(node.children)) {
            for (const child of node.children) {
                queue.push({ node: child, depth: depth + 1 });
            }
        }
    }

    console.error(
        `Frame traversal complete: found ${frames.length} frames, max depth: ${maxDepthSeen}`
    );
    if (frames.length === 0) {
        console.error(`Node type distribution: ${JSON.stringify(typeCounts)}`);
    }

    return frames;
}
