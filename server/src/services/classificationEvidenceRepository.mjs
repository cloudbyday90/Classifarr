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

import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { resolveExecutor } from '../utils/dbUtils.mjs';

const logger = createLogger('classificationEvidenceRepository');

const RELATED_SCOPES = new Set(['genre', 'studio', 'franchise', 'certification']);

class ClassificationEvidenceRepository {
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

  async findExactMatch({ tmdbId, mediaType }) {
    if (!tmdbId) return null;
    const result = await this.db.query(
      `SELECT *
         FROM classification_evidence
        WHERE scope      = 'item_exact'
          AND tmdb_id    = $1
          AND media_type = $2
          AND status     = 'active'
        ORDER BY confidence DESC, usage_count DESC
        LIMIT 1`,
      [tmdbId, mediaType]
    );
    return result.rows[0] ?? null;
  }

  async findRelatedEvidence({ libraryIds = [], mediaType = null, scope = null, minConfidence = 0 } = {}) {
    const conditions = [`status = 'active'`, `scope != 'item_exact'`];
    const params = [];

    if (libraryIds.length > 0) {
      params.push(libraryIds);
      conditions.push(`library_id = ANY($${params.length})`);
    }

    if (mediaType) {
      params.push(mediaType);
      conditions.push(`media_type = $${params.length}`);
    }

    if (scope) {
      params.push(scope);
      conditions.push(`scope = $${params.length}`);
    }

    if (minConfidence > 0) {
      params.push(minConfidence);
      conditions.push(`confidence >= $${params.length}`);
    }

    const result = await this.db.query(
      `SELECT *
         FROM classification_evidence
        WHERE ${conditions.join(' AND ')}
        ORDER BY confidence DESC, usage_count DESC`,
      params
    );
    return result.rows;
  }

  async listAll({ client = null } = {}) {
    const executor = resolveExecutor(client, this.db);
    const result = await executor.query(
      `SELECT * FROM classification_evidence ORDER BY id ASC`
    );
    return result.rows;
  }

  async findById(id) {
    const result = await this.db.query(
      `SELECT * FROM classification_evidence WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findPaginated({ scope = null, provenance = null, status = null, libraryId = null, mediaType = null, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const params = [];

    if (scope) {
      params.push(scope);
      conditions.push(`scope = $${params.length}`);
    }
    if (provenance) {
      params.push(provenance);
      conditions.push(`provenance = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (libraryId != null) {
      params.push(libraryId);
      conditions.push(`library_id = $${params.length}`);
    }
    if (mediaType) {
      params.push(mediaType);
      conditions.push(`media_type = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM classification_evidence ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const rowResult = await this.db.query(
      `SELECT * FROM classification_evidence
         ${where}
         ORDER BY id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: rowResult.rows, total };
  }

  async getSummary() {
    const [scopeResult, provenanceResult, statusResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT scope, COUNT(*) AS count
           FROM classification_evidence
           GROUP BY scope
           ORDER BY count DESC`
      ),
      this.db.query(
        `SELECT provenance, COUNT(*) AS count
           FROM classification_evidence
           GROUP BY provenance
           ORDER BY count DESC`
      ),
      this.db.query(
        `SELECT status, COUNT(*) AS count
           FROM classification_evidence
           GROUP BY status
           ORDER BY count DESC`
      ),
      this.db.query(`SELECT COUNT(*) AS count FROM classification_evidence`)
    ]);

    const byScope = Object.fromEntries(scopeResult.rows.map(r => [r.scope, parseInt(r.count, 10)]));
    const byProvenance = Object.fromEntries(provenanceResult.rows.map(r => [r.provenance, parseInt(r.count, 10)]));
    const byStatus = Object.fromEntries(statusResult.rows.map(r => [r.status, parseInt(r.count, 10)]));
    const total = parseInt(totalResult.rows[0].count, 10);

    return { byScope, byProvenance, byStatus, total };
  }

  async updateStatus({ id, status, actor: _actor = null }) {
    const result = await this.db.query(
      `UPDATE classification_evidence
          SET status     = $2,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, status]
    );
    return result.rows[0] ?? null;
  }

  async purgeByFilter({ scope = null, provenance = null, status = null, libraryId = null, mediaType = null, client = null } = {}) {
    const executor = resolveExecutor(client, this.db);
    const conditions = [];
    const params = [];

    if (scope) {
      params.push(scope);
      conditions.push(`scope = $${params.length}`);
    }
    if (provenance) {
      params.push(provenance);
      conditions.push(`provenance = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (libraryId != null) {
      params.push(libraryId);
      conditions.push(`library_id = $${params.length}`);
    }
    if (mediaType) {
      params.push(mediaType);
      conditions.push(`media_type = $${params.length}`);
    }

    if (conditions.length === 0) {
      throw new Error('purgeByFilter: at least one filter is required to prevent accidental full-table delete');
    }

    const result = await executor.query(
      `DELETE FROM classification_evidence WHERE ${conditions.join(' AND ')}`,
      params
    );
    return { deleted: result.rowCount ?? 0 };
  }

  async purgeByTmdbId({ tmdbId, mediaType = null, scopes = [], client = null }) {
    if (!tmdbId) return { deleted: 0 };
    const executor = resolveExecutor(client, this.db);

    const conditions = ['tmdb_id = $1'];
    const params = [tmdbId];

    if (mediaType) {
      params.push(mediaType);
      conditions.push(`media_type = $${params.length}`);
    }

    if (scopes.length > 0) {
      params.push(scopes);
      conditions.push(`scope = ANY($${params.length})`);
    }

    const result = await executor.query(
      `DELETE FROM classification_evidence WHERE ${conditions.join(' AND ')}`,
      params
    );
    return { deleted: result.rowCount ?? 0 };
  }

  async purgeAll({ client = null } = {}) {
    const executor = resolveExecutor(client, this.db);
    const result = await executor.query('DELETE FROM classification_evidence');
    return { deleted: result.rowCount ?? 0 };
  }
}

function createClassificationEvidenceRepository(deps = {}) {
  return new ClassificationEvidenceRepository(deps);
}

const classificationEvidenceRepository = createClassificationEvidenceRepository();

export {
  ClassificationEvidenceRepository,
  classificationEvidenceRepository,
  createClassificationEvidenceRepository,
  RELATED_SCOPES,
};
