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
 * evidenceHistoryReadModel.js
 *
 * Phase 3 read model for operator/reporting surfaces.
 *
 * Produces stable, pre-assembled evidence metadata for history, activity,
 * dashboard, and stats routes.  Surfaces this data:
 *   - winningEvidence         — the evidence row that best explains the result
 *   - authoritativeEvidence   — item_exact + human_confirmed row, if present
 *   - relatedEvidenceSummary  — grouped summary of related-scope evidence
 *   - methodLabel             — compatible display string for legacy UI surfaces
 *   - isAuthoritative         — boolean shortcut
 *
 * This is a read-only service; it never writes to any table.
 *
 * Future work (Phase 6): once the UI adopts the unified evidence model
 * natively, the compatibility wrappers here can be removed.
 */

'use strict';

const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const { buildCompatibilityPayload } = require('./evidenceCompatibilityMapper');
const { createLogger } = require('../utils/logger');

const logger = createLogger('evidenceHistoryReadModel');

// Scopes that contribute to the related-evidence summary
const RELATED_SCOPES = ['genre', 'studio', 'franchise', 'certification'];

class EvidenceHistoryReadModel {
  constructor(deps = {}) {
    this.repository = deps.repository || classificationEvidenceRepository;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build the full evidence summary for a single classified item.
   *
   * @param {object}      params
   * @param {number|null} params.tmdbId
   * @param {string}      params.mediaType
   * @param {number|null} [params.libraryId]    — optional: scope related evidence to one library
   * @param {number[]}    [params.libraryIds]   — optional: scope related evidence to a list
   * @param {string|null} [params.fallbackMethod] — legacy method from classification_history
   * @returns {Promise<ItemEvidenceSummary>}
   */
  async getItemSummary({ tmdbId, mediaType, libraryId = null, libraryIds = [], fallbackMethod = null } = {}) {
    try {
      const effectiveLibraryIds = libraryIds.length > 0
        ? libraryIds
        : (libraryId ? [libraryId] : []);

      const [exactMatch, relatedRows] = await Promise.all([
        this.repository.findExactMatch({ tmdbId, mediaType }),
        effectiveLibraryIds.length > 0
          ? this.repository.findRelatedEvidence({ libraryIds: effectiveLibraryIds, mediaType })
          : Promise.resolve([])
      ]);

      const authoritativeEvidence = (exactMatch?.provenance === 'human_confirmed') ? exactMatch : null;
      const winningEvidence       = exactMatch ?? (relatedRows[0] ?? null);
      const relatedEvidenceSummary = this._buildRelatedSummary(relatedRows);
      const compat = buildCompatibilityPayload(winningEvidence, fallbackMethod);

      return {
        winningEvidence,
        authoritativeEvidence,
        relatedEvidenceSummary,
        method:          compat.method,
        methodLabel:     compat.methodLabel,
        isAuthoritative: compat.isAuthoritative
      };
    } catch (err) {
      logger.warn('evidenceHistoryReadModel.getItemSummary: error fetching evidence', {
        tmdbId, mediaType, error: err.message
      });
      return this._emptyResult(fallbackMethod);
    }
  }

  /**
   * Build a lightweight summary suitable for a list/table row.
   * Cheaper than getItemSummary when related-scope detail is not needed.
   *
   * @param {object}      params
   * @param {number|null} params.tmdbId
   * @param {string}      params.mediaType
   * @param {string|null} [params.fallbackMethod]
   * @returns {Promise<{ method: string, methodLabel: string, isAuthoritative: boolean, hasExactMatch: boolean }>}
   */
  async getRowSummary({ tmdbId, mediaType, fallbackMethod = null } = {}) {
    try {
      const exactMatch = await this.repository.findExactMatch({ tmdbId, mediaType });
      const compat = buildCompatibilityPayload(exactMatch, fallbackMethod);
      return {
        method:          compat.method,
        methodLabel:     compat.methodLabel,
        isAuthoritative: compat.isAuthoritative,
        hasExactMatch:   exactMatch !== null
      };
    } catch (err) {
      logger.warn('evidenceHistoryReadModel.getRowSummary: error', { tmdbId, mediaType, error: err.message });
      const compat = buildCompatibilityPayload(null, fallbackMethod);
      return { ...compat, hasExactMatch: false };
    }
  }

  /**
   * Build a stats-level summary across all evidence for a list of libraries.
   * Returns scope-level counts suitable for a dashboard tile.
   *
   * @param {object} params
   * @param {number[]} params.libraryIds
   * @param {string}   [params.mediaType]
   * @returns {Promise<{ byScope: Record<string, number>, total: number, topItems: object[] }>}
   */
  async getLibrarySummary({ libraryIds, mediaType = null } = {}) {
    try {
      const rows = await this.repository.findRelatedEvidence({ libraryIds, mediaType });
      const byScope = {};
      for (const row of rows) {
        byScope[row.scope] = (byScope[row.scope] ?? 0) + 1;
      }
      const topItems = rows
        .filter(r => r.scope !== 'item_exact')
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 5);

      return { byScope, total: rows.length, topItems };
    } catch (err) {
      logger.warn('evidenceHistoryReadModel.getLibrarySummary: error', { libraryIds, error: err.message });
      return { byScope: {}, total: 0, topItems: [] };
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /**
   * Group related evidence rows by scope, returning the top candidate per scope.
   *
   * @param {object[]} relatedRows
   * @returns {Record<string, { count: number, topRow: object }>}
   */
  _buildRelatedSummary(relatedRows) {
    const summary = {};
    for (const scope of RELATED_SCOPES) {
      const scopeRows = relatedRows.filter(r => r.scope === scope);
      if (scopeRows.length === 0) continue;
      // Already ordered by confidence DESC from the repository query
      summary[scope] = {
        count:  scopeRows.length,
        topRow: scopeRows[0]
      };
    }
    return summary;
  }

  /**
   * Return an empty summary (used when DB queries fail).
   *
   * @param {string|null} fallbackMethod
   * @returns {ItemEvidenceSummary}
   */
  _emptyResult(fallbackMethod = null) {
    const compat = buildCompatibilityPayload(null, fallbackMethod);
    return {
      winningEvidence:       null,
      authoritativeEvidence: null,
      relatedEvidenceSummary: {},
      method:          compat.method,
      methodLabel:     compat.methodLabel,
      isAuthoritative: false
    };
  }
}

// Export singleton for default use; allow injection for tests
const evidenceHistoryReadModel = new EvidenceHistoryReadModel();

module.exports = evidenceHistoryReadModel;
module.exports.EvidenceHistoryReadModel = EvidenceHistoryReadModel;
