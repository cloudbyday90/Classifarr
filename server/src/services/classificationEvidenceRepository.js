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

/**
 * classificationEvidenceRepository.js
 *
 * All SQL for the classification_evidence table. This is the only place
 * that may issue DML against classification_evidence.
 *
 * Phase 3 role: receives dual-write fan-out from classificationEvidenceService.
 * Phase 4 role: will also serve as the authoritative read path.
 *
 * Conflict handling uses two partial unique indexes:
 *   item_exact  — (scope, tmdb_id, media_type) WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL
 *   related     — (scope, media_type, library_id, evidence_key)
 *                 WHERE scope IN ('genre','studio','franchise','certification')
 *
 * On conflict, usage_count is incremented and confidence/evidence_data may be
 * updated according to the caller's conflictMode preference.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationEvidenceRepository');

// Scope sets — used to route to the correct partial unique index
const RELATED_SCOPES = new Set(['genre', 'studio', 'franchise', 'certification']);

class ClassificationEvidenceRepository {
  constructor(deps = {}) {
    this.db = deps.db || db;
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Upsert one evidence record.
   *
   * For item_exact scope: conflicts on (scope, tmdb_id, media_type).
   * For related scopes:   conflicts on (scope, media_type, library_id, evidence_key).
   *
   * conflictMode:
   *   'do_nothing'      — leave existing row untouched, only bump usage_count
   *   'update_data'     — overwrite evidence_data + confidence, bump usage_count
   *
   * @param {object} record
   * @param {object} [opts]
   * @param {object} [opts.client]          — pass a DB client to join an existing transaction
   * @param {string} [opts.conflictMode]    — 'do_nothing' | 'update_data' (default: 'do_nothing')
   * @returns {Promise<object|null>}         — the upserted row or null on do_nothing conflict
   */
  async upsertEvidence(record, { client, conflictMode = 'do_nothing' } = {}) {
    const executor = client || this.db;
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
      // Partial unique index: (scope, tmdb_id, media_type) WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL
      // Rows with null tmdb_id are unindexed and can safely insert as separate rows.
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
      // Partial unique index: (scope, media_type, library_id, evidence_key)
      // WHERE scope IN ('genre','studio','franchise','certification')
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

    // Unknown scope — log and skip; do not throw so callers are not broken
    logger.warn('classificationEvidenceRepository.upsertEvidence: unrecognized scope, skipping', { scope });
    return null;
  }

  // ── Reads ────────────────────────────────────────────────────────────────────

  /**
   * Find item_exact evidence for a specific item.
   * Returns null when no match exists.
   *
   * @param {object} params
   * @param {number|null} params.tmdbId
   * @param {string} params.mediaType
   * @returns {Promise<object|null>}
   */
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

  /**
   * Find all active related-scope evidence for a set of library IDs.
   * Optionally filter by scope and/or media_type.
   *
   * @param {object} params
   * @param {number[]} [params.libraryIds]
   * @param {string}   [params.mediaType]
   * @param {string}   [params.scope]
   * @param {string}   [params.minConfidence]  — minimum confidence threshold (0–100)
   * @returns {Promise<object[]>}
   */
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

  /**
   * List all evidence rows. Used by backup/admin endpoints.
   *
   * @param {object} [opts]
   * @param {object} [opts.client]
   * @returns {Promise<object[]>}
   */
  async listAll({ client = null } = {}) {
    const executor = client || this.db;
    const result = await executor.query(
      `SELECT * FROM classification_evidence ORDER BY id ASC`
    );
    return result.rows;
  }

  /**
   * Find a single evidence row by its PK.
   *
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const result = await this.db.query(
      `SELECT * FROM classification_evidence WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Paginated, filtered list for admin surfaces.
   *
   * @param {object} params
   * @param {string}   [params.scope]
   * @param {string}   [params.provenance]
   * @param {string}   [params.status]
   * @param {number}   [params.libraryId]
   * @param {string}   [params.mediaType]
   * @param {number}   [params.limit]    default 50
   * @param {number}   [params.offset]   default 0
   * @returns {Promise<{ rows: object[], total: number }>}
   */
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

  /**
   * Aggregate counts by scope, provenance and status for the summary endpoint.
   *
   * @returns {Promise<{ byScope: object, byProvenance: object, byStatus: object, total: number }>}
   */
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

    const byScope      = Object.fromEntries(scopeResult.rows.map(r => [r.scope, parseInt(r.count, 10)]));
    const byProvenance = Object.fromEntries(provenanceResult.rows.map(r => [r.provenance, parseInt(r.count, 10)]));
    const byStatus     = Object.fromEntries(statusResult.rows.map(r => [r.status, parseInt(r.count, 10)]));
    const total        = parseInt(totalResult.rows[0].count, 10);

    return { byScope, byProvenance, byStatus, total };
  }

  /**
   * Update the status of a single evidence row. Used by decay/promote admin actions.
   *
   * @param {object} params
   * @param {number} params.id
   * @param {string} params.status    — 'active' | 'candidate'
   * @param {string} [params.actor]
   * @returns {Promise<object|null>}   — updated row, or null when not found
   */
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

  /**
   * Bulk purge by flexible filter set. Used by POST /evidence/purge admin endpoint.
   * At least one filter must be set to prevent accidental full-table deletes.
   *
   * @param {object} params
   * @param {string}   [params.scope]
   * @param {string}   [params.provenance]
   * @param {string}   [params.status]
   * @param {number}   [params.libraryId]
   * @param {string}   [params.mediaType]
   * @param {object}   [params.client]
   * @returns {Promise<{deleted: number}>}
   */
  async purgeByFilter({ scope = null, provenance = null, status = null, libraryId = null, mediaType = null, client = null } = {}) {
    const executor = client || this.db;
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

  // ── Deletes ──────────────────────────────────────────────────────────────────

  /**
   * Purge evidence rows for a specific item.
   * scopes = [] means all scopes for that tmdb_id + media_type.
   *
   * @param {object} params
   * @param {number|null} params.tmdbId
   * @param {string}      [params.mediaType]
   * @param {string[]}    [params.scopes]    — limiting scope list, e.g. ['item_exact']
   * @param {object}      [params.client]
   * @returns {Promise<{deleted: number}>}
   */
  async purgeByTmdbId({ tmdbId, mediaType = null, scopes = [], client = null }) {
    if (!tmdbId) return { deleted: 0 };
    const executor = client || this.db;

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

  /**
   * Delete all evidence rows. Used by admin reset flows.
   *
   * @param {object} [opts]
   * @param {object} [opts.client]
   * @returns {Promise<{deleted: number}>}
   */
  async purgeAll({ client = null } = {}) {
    const executor = client || this.db;
    const result = await executor.query('DELETE FROM classification_evidence');
    return { deleted: result.rowCount ?? 0 };
  }
}

module.exports = new ClassificationEvidenceRepository();
module.exports.ClassificationEvidenceRepository = ClassificationEvidenceRepository;
