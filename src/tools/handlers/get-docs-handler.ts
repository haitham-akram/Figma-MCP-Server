/**
 * Get Documentation Handler
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Execute the getDocumentation tool
 */
export async function getDocumentationHandler() {
    try {
        const docsPath = join(__dirname, '..', '..', '..', 'COPILOT_INSTRUCTIONS.md');
        const content = readFileSync(docsPath, 'utf-8');

        return {
            instructions: content,
        };
    } catch (error) {
        throw {
            code: -32603,
            message: 'Failed to read documentation file',
            data: { error: error instanceof Error ? error.message : String(error) },
        };
    }
}
