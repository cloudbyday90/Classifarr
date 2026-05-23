import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as errorsModule from '../utils/errors.mjs';

const logger = createLogger('mediaSync');

export async function pruneMissingMediaItems(libraryId, seenExternalIds = []) {
    try {
        const result = seenExternalIds.length > 0
            ? await db.query(
                `DELETE FROM media_server_items
                 WHERE library_id = $1
                   AND NOT (external_id = ANY($2::text[]))`,
                [libraryId, seenExternalIds],
            )
            : await db.query(
                `DELETE FROM media_server_items
                 WHERE library_id = $1`,
                [libraryId],
            );

        return result.rowCount || 0;
    } catch (error) {
        logger.error('Failed to prune missing media items after full sync', {
            libraryId,
            error: error.message,
        });
        throw error;
    }
}

export async function pruneMissingCollections(libraryId, seenExternalIds = []) {
    try {
        const result = seenExternalIds.length > 0
            ? await db.query(
                `DELETE FROM media_server_collections
                 WHERE library_id = $1
                   AND NOT (external_id = ANY($2::text[]))`,
                [libraryId, seenExternalIds],
            )
            : await db.query(
                `DELETE FROM media_server_collections
                 WHERE library_id = $1`,
                [libraryId],
            );

        return result.rowCount || 0;
    } catch (error) {
        logger.error('Failed to prune missing collections after full sync', {
            libraryId,
            error: error.message,
        });
        throw error;
    }
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
    try {
        const serverResult = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

        if (serverResult.rows.length === 0) {
            throw new Error('No active media server configured');
        }

        const server = serverResult.rows[0];
        const service = await getMediaServerService(server.type);
        const libraries = await service.getLibraries(server.url, server.api_key);

        const syncedLibraries = [];
        for (const library of libraries) {
            let arrType = null;
            if (library.media_type === 'movie') {
                arrType = 'radarr';
            } else if (library.media_type === 'tv') {
                arrType = 'sonarr';
            }

            const result = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (media_server_id, external_id) 
                 DO UPDATE SET name = EXCLUDED.name, media_type = EXCLUDED.media_type, arr_type = EXCLUDED.arr_type
                 RETURNING *`,
                [server.id, library.external_id, library.name, library.media_type, arrType],
            );

            syncedLibraries.push(result.rows[0]);
        }

        logger.info('Synced libraries from media server', {
            mediaServer: server.type,
            count: syncedLibraries.length,
        });

        return syncedLibraries;
    } catch (error) {
        logger.error('Failed to sync libraries from media server', { error: error.message });
        throw error;
    }
}
