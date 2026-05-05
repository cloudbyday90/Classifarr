/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationLearnedCorrectionsService');

class ClassificationLearnedCorrectionsService {
  constructor(deps = {}) {
    this.db = deps.db || defaultDb;
    this.logger = deps.logger || logger;
  }

  async checkLearnedCorrections(tmdbId, mediaType) {
    if (!tmdbId) return null;

    try {
      const result = await this.db.query(
        `SELECT corrected_library_id, corrected_by, title, created_at, user_note
         FROM learned_corrections
         WHERE tmdb_id = $1 AND media_type = $2
         ORDER BY created_at DESC LIMIT 1`,
        [tmdbId, mediaType]
      );

      if (result.rows.length > 0) {
        this.logger.info('Found learned correction', {
          tmdbId,
          mediaType,
          correctedLibraryId: result.rows[0].corrected_library_id,
        });
      }

      return result.rows[0] || null;
    } catch (error) {
      this.logger.warn('Failed to check learned corrections', { error: error.message });
      return null;
    }
  }
}

const classificationLearnedCorrectionsService = new ClassificationLearnedCorrectionsService();

export {
  ClassificationLearnedCorrectionsService,
  classificationLearnedCorrectionsService,
};
