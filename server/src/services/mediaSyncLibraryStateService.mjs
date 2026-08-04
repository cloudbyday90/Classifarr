/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('mediaSyncLibraryStateService');

export class MediaSyncLibraryStateService {
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

export const mediaSyncLibraryStateService = new MediaSyncLibraryStateService();
