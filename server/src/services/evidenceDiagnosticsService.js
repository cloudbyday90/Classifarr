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
 * evidenceDiagnosticsService.js
 *
 * Phase 6 — Layer 4 operator debug read model.
 *
 * Compares a classification_evidence row against:
 *   1. PolicyEngine history for the same item (classification_history)
 *   2. Related evidence (other rows for the same library)
 *   3. Evidence comparison data (legacy vs new table parity)
 *
 * This is read-only and diagnostic-only. It must never be on the hot
 * classification path. Errors are swallowed with logging.
 *
 * Exported for dependency injection in tests.
 */

'use strict';

const db = require('../config/database');
const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const { buildCompatibilityPayload } = require('./evidenceCompatibilityMapper');
const { createLogger } = require('../utils/logger');

const logger = createLogger('evidenceDiagnosticsService');

// Maximum recent history rows returned per diagnostic
const MAX_HISTORY_ROWS = 10;

class EvidenceDiagnosticsService {
  constructor(deps = {}) {
    this.db         = deps.db         || db;
    this.repository = deps.repository || classificationEvidenceRepository;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Produce a diagnostic report for a single evidence row.
   *
   * @param {object} evidenceRow  — a classification_evidence row
   * @returns {Promise<DiagnosticReport>}
   */
  async diagnose(evidenceRow) {
    if (!evidenceRow) return this._emptyReport('no evidence row supplied');

    try {
      const [history, related, compat] = await Promise.all([
        this._getRecentHistory(evidenceRow),
        this._getRelatedEvidence(evidenceRow),
        Promise.resolve(buildCompatibilityPayload(evidenceRow))
      ]);

      const agreement = this._assessAgreement(evidenceRow, history);

      return {
        evidenceId:        evidenceRow.id,
        scope:             evidenceRow.scope,
        provenance:        evidenceRow.provenance,
        status:            evidenceRow.status,
        confidence:        evidenceRow.confidence,
        usageCount:        evidenceRow.usage_count,
        successRate:       evidenceRow.success_rate,
        compat,
        history: {
          recentCount: history.length,
          rows: history
        },
        related: {
          count: related.length,
          scopes: this._summarizeByScope(related)
        },
        agreement
      };
    } catch (err) {
      logger.warn('evidenceDiagnosticsService.diagnose: error', {
        evidenceId: evidenceRow.id,
        error: err.message
      });
      return this._emptyReport(err.message);
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /**
   * Fetch recent classification history for the item this evidence row represents.
   *
   * @param {object} evidenceRow
   * @returns {Promise<object[]>}
   */
  async _getRecentHistory(evidenceRow) {
    try {
      if (!evidenceRow.tmdb_id) return [];

      const result = await this.db.query(
        `SELECT id, method, confidence, library_id, classified_at, metadata
           FROM classification_history
          WHERE tmdb_id    = $1
            AND media_type = $2
          ORDER BY classified_at DESC
          LIMIT $3`,
        [evidenceRow.tmdb_id, evidenceRow.media_type, MAX_HISTORY_ROWS]
      );
      return result.rows;
    } catch (err) {
      logger.warn('evidenceDiagnosticsService._getRecentHistory: failed', { error: err.message });
      return [];
    }
  }

  /**
   * Fetch related-scope evidence from the same library.
   *
   * @param {object} evidenceRow
   * @returns {Promise<object[]>}
   */
  async _getRelatedEvidence(evidenceRow) {
    try {
      if (!evidenceRow.library_id) return [];
      return await this.repository.findRelatedEvidence({
        libraryIds: [evidenceRow.library_id],
        mediaType: evidenceRow.media_type || null
      });
    } catch (err) {
      logger.warn('evidenceDiagnosticsService._getRelatedEvidence: failed', { error: err.message });
      return [];
    }
  }

  /**
   * Compare the evidence row's method against the most recent history.
   *
   * @param {object}   evidenceRow
   * @param {object[]} history
   * @returns {{ consistent: boolean, message: string, lastHistoryMethod: string|null }}
   */
  _assessAgreement(evidenceRow, history) {
    const compatMethod = buildCompatibilityPayload(evidenceRow).method;
    const lastHistory  = history[0] ?? null;

    if (!lastHistory) {
      return { consistent: null, message: 'No classification history available for comparison', lastHistoryMethod: null };
    }

    const consistent = lastHistory.method === compatMethod;
    const message = consistent
      ? `Evidence method '${compatMethod}' matches most recent classification`
      : `Evidence method '${compatMethod}' does not match most recent classification method '${lastHistory.method}'`;

    return { consistent, message, lastHistoryMethod: lastHistory.method };
  }

  /**
   * Group related rows by scope.
   *
   * @param {object[]} rows
   * @returns {Record<string, number>}
   */
  _summarizeByScope(rows) {
    const summary = {};
    for (const row of rows) {
      summary[row.scope] = (summary[row.scope] ?? 0) + 1;
    }
    return summary;
  }

  /**
   * Empty/error diagnostic report.
   *
   * @param {string} [reason]
   * @returns {DiagnosticReport}
   */
  _emptyReport(reason = null) {
    return {
      evidenceId:  null,
      scope:       null,
      provenance:  null,
      status:      null,
      confidence:  null,
      usageCount:  null,
      successRate: null,
      compat:      null,
      history:     { recentCount: 0, rows: [] },
      related:     { count: 0, scopes: {} },
      agreement:   { consistent: null, message: reason ?? 'No data available', lastHistoryMethod: null }
    };
  }
}

module.exports = new EvidenceDiagnosticsService();
module.exports.EvidenceDiagnosticsService = EvidenceDiagnosticsService;
