/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationLearnedCorrectionsService');

/**
 * Look up a user-confirmed correction for a specific TMDB ID + media type.
 * Learned corrections carry HIGHEST PRIORITY in the decision tree — user truth.
 *
 * Returns the most-recent correction row or null if none exists.
 * Returns null (with a logged warning) when the table is missing
 * in older installations — non-fatal.
 *
 * @param {number|string} tmdbId
 * @param {'movie'|'show'} mediaType
 * @param {object} [db]
 * @returns {Promise<object|null>}
 */
async function checkLearnedCorrections(tmdbId, mediaType, db = defaultDb) {
  if (!tmdbId) return null;

  try {
    const result = await db.query(
      `SELECT corrected_library_id, corrected_by, title, created_at, user_note
       FROM learned_corrections
       WHERE tmdb_id = $1 AND media_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tmdbId, mediaType]
    );

    if (result.rows.length > 0) {
      logger.info('Found learned correction', {
        tmdbId,
        mediaType,
        correctedLibraryId: result.rows[0].corrected_library_id,
      });
    }

    return result.rows[0] || null;
  } catch (error) {
    // Table may not exist in older installations — non-fatal
    logger.warn('Failed to check learned corrections', { error: error.message });
    return null;
  }
}

module.exports = { checkLearnedCorrections };
