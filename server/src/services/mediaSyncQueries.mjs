import { mediaSyncDatabase as db, requireOwnedMediaSyncDatabase } from './mediaSyncDatabaseScope.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as errorsModule from '../utils/errors.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import { reconcileMediaServerLibraries } from './mediaServerLibrarySync.mjs';

const logger = createLogger('mediaSync');

export async function pruneMissingMediaItems(libraryId, seenExternalIds = []) {
    const ownedDb = requireOwnedMediaSyncDatabase(libraryId);
    return withServiceCatch(logger, 'Failed to prune missing media items after full sync', { libraryId }, async () => {
        const result = seenExternalIds.length > 0
            ? await ownedDb.query(
                `DELETE FROM media_server_items
                 WHERE library_id = $1
                   AND NOT (external_id = ANY($2::text[]))`,
                [libraryId, seenExternalIds],
            )
            : await ownedDb.query(
                `DELETE FROM media_server_items
                 WHERE library_id = $1`,
                [libraryId],
            );

        return result.rowCount || 0;
    });
}

export async function pruneMissingCollections(libraryId, seenExternalIds = []) {
    const ownedDb = requireOwnedMediaSyncDatabase(libraryId);
    return withServiceCatch(logger, 'Failed to prune missing collections after full sync', { libraryId }, async () => {
        const result = seenExternalIds.length > 0
            ? await ownedDb.query(
                `DELETE FROM media_server_collections
                 WHERE library_id = $1
                   AND NOT (external_id = ANY($2::text[]))`,
                [libraryId, seenExternalIds],
            )
            : await ownedDb.query(
                `DELETE FROM media_server_collections
                 WHERE library_id = $1`,
                [libraryId],
            );

        return result.rowCount || 0;
    });
}

export async function getSyncStatus(libraryId = null) {
    try {
        let query = `
            SELECT ss.*, l.name as library_name, ms.name as media_server_name
            FROM media_server_sync_status ss
            LEFT JOIN libraries l ON ss.library_id = l.id
            LEFT JOIN media_server ms ON ss.media_server_id = ms.id
        `;

        const params = [];
        if (libraryId) {
            query += ' WHERE ss.library_id = $1';
            params.push(libraryId);
        }

        query += ' ORDER BY ss.created_at DESC LIMIT 50';

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('Error getting sync status', { error: error.message });
        return [];
    }
}

export async function getLibraryItems(libraryId, options = {}) {
    const { LibraryNotFoundError, isLibraryNotFoundError } = errorsModule;
    const { limit = 50, offset = 0 } = options;

    try {
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);

        if (libraryCheck.rows.length === 0) {
            logger.warn('Library not found when getting items', { libraryId });
            throw new LibraryNotFoundError(libraryId);
        }

        const result = await db.query(
            `SELECT * FROM media_server_items
             WHERE library_id = $1
             ORDER BY added_at DESC
             LIMIT $2 OFFSET $3`,
            [libraryId, limit, offset],
        );

        const countResult = await db.query(
            'SELECT COUNT(*) FROM media_server_items WHERE library_id = $1',
            [libraryId],
        );

        return {
            items: result.rows,
            total: Number.parseInt(countResult.rows[0].count, 10),
        };
    } catch (error) {
        if (!isLibraryNotFoundError(error)) {
            logger.error('Error getting library items', { libraryId, error: error.message });
        }
        throw error;
    }
}

export async function syncLibrariesFromMediaServer(getMediaServerService) {
    return withServiceCatch(logger, 'Failed to sync libraries from media server', async () => {
        const result = await reconcileMediaServerLibraries({ db, getMediaServerServiceByType: getMediaServerService });
        return result.libraries.filter(library => library.is_active === true);
    });
}
