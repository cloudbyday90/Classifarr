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

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { resolveExecutor } from '../utils/dbUtils.mjs';
import {
  findExactMatch as _findExactMatch,
  findRelatedEvidence as _findRelatedEvidence,
  listAll as _listAll,
  findById as _findById,
  findPaginated as _findPaginated,
  getSummary as _getSummary,
  updateStatus as _updateStatus,
} from './classificationEvidenceQueries.mjs';
import {
  purgeByFilter as _purgeByFilter,
  purgeByTmdbId as _purgeByTmdbId,
  purgeAll as _purgeAll,
} from './classificationEvidencePurge.mjs';

const logger = createLogger('classificationEvidenceRepository');

export const RELATED_SCOPES = new Set(['genre', 'studio', 'franchise', 'certification']);

export class ClassificationEvidenceRepository {
  constructor(deps = {}) {
    this.db = deps.db || db;
  }

  async upsertEvidence(record, { client, conflictMode = 'do_nothing' } = {}) {
    const executor = resolveExecutor(client, this.db);
    const {
      scope,
      tmdbId,
      mediaType,
      libraryId,
      evidenceKey,
      evidenceData,
      confidence,
      usageCount,
      successRate,
      provenance,
      status,
      createdBy,
      sourceClassificationId,
      sourceSystem
    } = record;

    const isRelated = RELATED_SCOPES.has(scope);
    const isItemExact = scope === 'item_exact';

    const dataParams = [
      scope, tmdbId ?? null, mediaType ?? null, libraryId ?? null,
      evidenceKey ?? null, evidenceData ? JSON.stringify(evidenceData) : null,
      confidence ?? (isItemExact ? 100 : 85), usageCount ?? 0, successRate ?? null,
      provenance, status ?? 'active',
      createdBy ?? null, sourceClassificationId ?? null, sourceSystem ?? null
    ];

    if (isItemExact) {
      const conflictAction = (conflictMode === 'update_data')
        ? `DO UPDATE SET evidence_data = EXCLUDED.evidence_data,
                         confidence    = EXCLUDED.confidence,
                         usage_count   = classification_evidence.usage_count + 1,
                         updated_at    = NOW()`
        : `DO NOTHING`;

      const result = await executor.query(
        `INSERT INTO classification_evidence
           (scope, tmdb_id, media_type, library_id, evidence_key, evidence_data,
            confidence, usage_count, success_rate, provenance, status,
            created_by, source_classification_id, source_system)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (scope, tmdb_id, media_type)
           WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL
           ${conflictAction}
         RETURNING *`,
        dataParams
      );
      return result.rows[0] ?? null;
    }

    if (isRelated) {
      const onConflictUpdate = (conflictMode === 'update_data')
        ? `evidence_data = EXCLUDED.evidence_data,
           confidence    = LEAST(classification_evidence.confidence + 2, 95),
           usage_count   = classification_evidence.usage_count + 1,
           updated_at    = NOW()`
        : `usage_count   = classification_evidence.usage_count + 1,
           updated_at    = NOW()`;

      const result = await executor.query(
        `INSERT INTO classification_evidence
           (scope, tmdb_id, media_type, library_id, evidence_key, evidence_data,
            confidence, usage_count, success_rate, provenance, status,
            created_by, source_classification_id, source_system)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (scope, media_type, library_id, evidence_key)
           WHERE scope IN ('genre', 'studio', 'franchise', 'certification')
           DO UPDATE SET ${onConflictUpdate}
         RETURNING *`,
        dataParams
      );
      return result.rows[0] ?? null;
    }

    logger.warn('classificationEvidenceRepository.upsertEvidence: unrecognized scope, skipping', { scope });
    return null;
  }

  async findExactMatch(params) {
    return _findExactMatch(this.db, params);
  }

  async findRelatedEvidence(params = {}) {
    return _findRelatedEvidence(this.db, params);
  }

  async listAll(options = {}) {
    return _listAll(this.db, options);
  }

  async findById(id) {
    return _findById(this.db, id);
  }

  async findPaginated(params = {}) {
    return _findPaginated(this.db, params);
  }

  async getSummary() {
    return _getSummary(this.db);
  }

  async updateStatus(params) {
    return _updateStatus(this.db, params);
  }

  async purgeByFilter(params = {}) {
    return _purgeByFilter(this.db, params);
  }

  async purgeByTmdbId(params) {
    return _purgeByTmdbId(this.db, params);
  }

  async purgeAll(options = {}) {
    return _purgeAll(this.db, options);
  }
}

export function createClassificationEvidenceRepository(deps = {}) {
  return new ClassificationEvidenceRepository(deps);
}

export const classificationEvidenceRepository = createClassificationEvidenceRepository();
