import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { persistSyncedMediaItem } from './mediaSyncItemPersistence.mjs';
import { sourceIdentityDiagnostics } from './mediaSyncIdentityDiagnostics.mjs';

const logger = createLogger('mediaSync');

/**
 * @param {{reason: string, [key: string]: unknown}} details
 * @param {((details: {reason: string, [key: string]: unknown}) => void) | undefined} onSkippedItem
 */
function reportSkippedItem(details, onSkippedItem) {
    if (typeof onSkippedItem === 'function') {
        onSkippedItem(details);
        return;
    }
    logger.warn('Skipping media item', details);
}

/**
 * @param {number} mediaServerId
 * @param {number} libraryId
 * @param {Record<string, unknown>} item
 * @param {{onSkippedItem?: (details: {reason: string, [key: string]: unknown}) => void}} [options]
 */
export async function upsertMediaItem(mediaServerId, libraryId, item, options = {}) {
    const { onSkippedItem } = options;
    const captured = structuredClone(item);
    try {
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
        if (libraryCheck.rows.length === 0) {
            logger.warn(`Skipping media item - library ${libraryId} no longer exists (likely deleted during re-sync)`, {
                item: captured.external_id,
            });
            return;
        }
        const result = await persistSyncedMediaItem(mediaServerId, libraryId, captured, {
            query: (text, values) => db.query(text, values),
            analyze: (...args) => contentTypeAnalyzer.analyze(...args),
        });
        if (result !== 'synced') reportSkippedItem({
            reason: result,
            ...(result === 'invalid_source_identity' ? sourceIdentityDiagnostics(mediaServerId, libraryId, captured) : {}),
        }, onSkippedItem);
    } catch (error) {
        if (error.code === '23503') {
            logger.warn(`Skipping media item - library ${libraryId} no longer exists (race condition)`, {
                item: captured.external_id,
            });
            return;
        }
        logger.error('Error upserting media item', { item: captured.external_id, error: error.message });
    }
}

export async function upsertCollection(mediaServerId, libraryId, collection) {
    try {
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
        if (libraryCheck.rows.length === 0) {
            logger.warn(`Skipping collection - library ${libraryId} no longer exists`, {
                collection: collection.name,
            });
            return;
        }

        await db.query(
            `INSERT INTO media_server_collections
             (media_server_id, library_id, external_id, name, item_count, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (media_server_id, external_id)
             DO UPDATE SET
               name = EXCLUDED.name,
               item_count = EXCLUDED.item_count,
               last_synced = NOW()`,
            [mediaServerId, libraryId, collection.external_id, collection.name, collection.item_count || 0],
        );
    } catch (error) {
        if (error.code === '23503') {
            logger.warn(`Skipping collection - library ${libraryId} no longer exists (race condition)`, {
                collection: collection.name,
            });
            return;
        }
        logger.error('Error upserting collection', { collection: collection.name, error: error.message });
    }
}
