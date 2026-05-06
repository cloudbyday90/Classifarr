/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('mediaSyncLibraryStateService');

class MediaSyncLibraryStateService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || defaultLogger;
  }

  async findExistingMedia(tmdbId, mediaType) {
    try {
      const result = await this.db.query(
        `SELECT msi.*, l.name as library_name, l.id as library_id
         FROM media_server_items msi
         JOIN libraries l ON msi.library_id = l.id
         WHERE msi.tmdb_id = $1 AND msi.media_type = $2
         LIMIT 1`,
        [tmdbId, mediaType],
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error('Error finding existing media', { tmdbId, error: error.message });
      return null;
    }
  }

  async getLibraryContext(tmdbId, metadata) {
    const existingItem = await this.findExistingMedia(tmdbId, metadata.media_type);

    if (!existingItem) {
      return null;
    }

    return {
      exists: true,
      library_id: existingItem.library_id,
      library_name: existingItem.library_name,
      title: existingItem.title,
      year: existingItem.year,
      added_at: existingItem.added_at,
      collections: existingItem.collections || [],
      tags: existingItem.tags || [],
    };
  }

  async reconcileAwaitingDecisions(libraryId) {
    try {
      this.logger.debug('Reconciling awaiting decisions with synced media', { libraryId });

      const reconciledResult = await this.db.query(`
        UPDATE classification_history ch
        SET 
          status = 'completed',
          library_id = msi.library_id,
          library_name = l.name,
          method = 'source_library',
          reason = 'Resolved via library placement',
          confidence = 100
        FROM media_server_items msi
        JOIN libraries l ON msi.library_id = l.id
        WHERE ch.tmdb_id = msi.tmdb_id
          AND ch.media_type = msi.media_type
          AND ch.status = 'awaiting_decision'
          AND msi.library_id = $1
        RETURNING ch.id, ch.tmdb_id, ch.media_type, ch.title, l.id as library_id, l.name as library_name
      `, [libraryId]);

      if (reconciledResult.rows.length > 0) {
        this.logger.info('Reconciled awaiting decisions', {
          libraryId,
          count: reconciledResult.rows.length,
          items: reconciledResult.rows.map((row) => ({ title: row.title, library: row.library_name })),
        });

        for (const item of reconciledResult.rows) {
          try {
            await this.db.query(`
              INSERT INTO learned_corrections (tmdb_id, media_type, corrected_library_id, title, corrected_by)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (tmdb_id, media_type) DO UPDATE
              SET corrected_library_id = EXCLUDED.corrected_library_id,
                  title = EXCLUDED.title
            `, [item.tmdb_id, item.media_type, item.library_id, item.title, 'plex_reconciliation']);
          } catch (error) {
            this.logger.warn('Failed to create learned correction for reconciled item', {
              tmdb_id: item.tmdb_id,
              error: error.message,
            });
          }
        }
      } else {
        this.logger.debug('No awaiting decisions to reconcile', { libraryId });
      }

      return reconciledResult.rows.length;
    } catch (error) {
      this.logger.error('Failed to reconcile awaiting decisions', {
        libraryId,
        error: error.message,
      });
      return 0;
    }
  }
}

const mediaSyncLibraryStateService = new MediaSyncLibraryStateService();

export {
  MediaSyncLibraryStateService,
  mediaSyncLibraryStateService,
};
