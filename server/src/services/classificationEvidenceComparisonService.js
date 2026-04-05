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
 * classificationEvidenceComparisonService.js
 *
 * Phase 3 shadow-comparison service. Compares evidence from the legacy tables
 * (via classificationEvidenceService) against the new classification_evidence
 * table (via classificationEvidenceRepository) and produces structured mismatch
 * records for observability and debugging.
 *
 * Rules:
 * - This service is NEVER on the hot classification path.
 * - Call sites are background/diagnostic paths only.
 * - Errors are logged and swallowed; no comparison failure should surface upstream.
 * - Results are not yet acted upon — they are for monitoring Phase 3 parity.
 */

const classificationEvidenceService = require('./classificationEvidenceService');
const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationEvidenceComparisonService');

// Mismatch reason labels used in comparison records
const MISMATCH_REASON = {
  MISSING_BACKFILL:    'missing_backfill',        // row present in legacy, absent in new table
  PROVENANCE_MISMATCH: 'provenance_mismatch',
  STATUS_MISMATCH:     'status_mismatch',
  NORMALIZATION:       'normalization_mismatch',   // key format differs
  EXTRA_IN_NEW:        'extra_evidence_candidate_not_used_by_legacy',
  LIBRARY_MISMATCH:    'library_id_mismatch'
};

class ClassificationEvidenceComparisonService {
  constructor(deps = {}) {
    this.evidenceService    = deps.evidenceService    || classificationEvidenceService;
    this.evidenceRepository = deps.evidenceRepository || classificationEvidenceRepository;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Compare the item_exact evidence for a specific item between the legacy
   * adapter result and the new table.
   *
   * @param {object} params
   * @param {number|null} params.tmdbId
   * @param {string}      params.mediaType
   * @param {object|null} [params.legacyResult] — pre-fetched legacy result; if
   *   omitted the service will fetch it
   * @returns {Promise<ComparisonRecord>}
   */
  async compareExactMatch({ tmdbId, mediaType, legacyResult = undefined }) {
    try {
      const [legacy, newRow] = await Promise.all([
        legacyResult !== undefined
          ? Promise.resolve(legacyResult)
          : this.evidenceService.findExactMatch({ tmdbId, mediaType }),
        this.evidenceRepository.findExactMatch({ tmdbId, mediaType })
      ]);

      const legacyLibraryId  = legacy?.library_id   ?? null;
      const evidenceLibraryId = newRow?.library_id  ?? null;
      const consistent = legacyLibraryId !== null
        ? legacyLibraryId === evidenceLibraryId
        : newRow === null; // both absent is consistent

      const reasons = [];
      if (legacy && !newRow)                               reasons.push(MISMATCH_REASON.MISSING_BACKFILL);
      if (legacyLibraryId !== null && !consistent)         reasons.push(MISMATCH_REASON.LIBRARY_MISMATCH);
      if (legacy && newRow && legacy.provenance !== newRow.provenance) reasons.push(MISMATCH_REASON.PROVENANCE_MISMATCH);
      if (legacy && newRow && legacy.status     !== newRow.status)     reasons.push(MISMATCH_REASON.STATUS_MISMATCH);

      return {
        type: 'exact',
        tmdbId,
        mediaType,
        legacy: legacyLibraryId,
        evidence: evidenceLibraryId,
        consistent,
        reasons: consistent ? [] : reasons
      };
    } catch (err) {
      logger.warn('compareExactMatch failed', { tmdbId, mediaType, error: err.message });
      return { type: 'exact', tmdbId, mediaType, error: err.message };
    }
  }

  /**
   * Compare the related evidence set for an item between the legacy adapter
   * and the new table.
   *
   * @param {object} params
   * @param {object}   params.metadata         — item metadata (title, genres, etc.)
   * @param {number[]} [params.libraryIds]      — candidate library IDs
   * @param {string}   [params.mediaType]
   * @returns {Promise<ComparisonRecord>}
   */
  async compareRelatedEvidence({ metadata, libraryIds = [], mediaType = null }) {
    try {
      const [legacyItems, newItems] = await Promise.all([
        this.evidenceService.collectRelatedEvidence({
          metadata,
          candidateLibraryIds: libraryIds.length > 0 ? libraryIds : null,
          includeDiscoveredPatterns: true
        }),
        this.evidenceRepository.findRelatedEvidence({
          libraryIds,
          mediaType: mediaType || metadata?.media_type || null
        })
      ]);

      const legacyKeys  = legacyItems.map(e => e.evidenceKey).filter(Boolean).sort();
      const evidenceKeys = newItems.map(e => e.evidence_key).filter(Boolean).sort();

      const legacySet   = new Set(legacyKeys);
      const evidenceSet = new Set(evidenceKeys);

      const missingInNew  = legacyKeys.filter(k => !evidenceSet.has(k));
      const extraInNew    = evidenceKeys.filter(k => !legacySet.has(k));
      const consistent    = missingInNew.length === 0 && extraInNew.length === 0;

      const reasons = [];
      if (missingInNew.length > 0) reasons.push(MISMATCH_REASON.MISSING_BACKFILL);
      if (extraInNew.length > 0)   reasons.push(MISMATCH_REASON.EXTRA_IN_NEW);

      return {
        type: 'related',
        mediaType: mediaType || metadata?.media_type || null,
        libraryIds,
        legacyKeys,
        evidenceKeys,
        consistent,
        reasons: consistent ? [] : reasons,
        detail: consistent ? null : { missingInNew, extraInNew }
      };
    } catch (err) {
      logger.warn('compareRelatedEvidence failed', { error: err.message });
      return { type: 'related', error: err.message };
    }
  }

  /**
   * Build a full comparison record for one classification event.
   * Combines exact + related comparisons.
   *
   * @param {object} params
   * @param {number}   params.classificationId
   * @param {number}   params.tmdbId
   * @param {string}   params.mediaType
   * @param {object}   params.metadata
   * @param {number[]} [params.candidateLibraryIds]
   * @returns {Promise<FullComparisonRecord>}
   */
  async buildComparisonRecord({ classificationId, tmdbId, mediaType, metadata, candidateLibraryIds = [] }) {
    const [exact, related] = await Promise.all([
      this.compareExactMatch({ tmdbId, mediaType }),
      this.compareRelatedEvidence({ metadata, libraryIds: candidateLibraryIds, mediaType })
    ]);

    const fullyConsistent = exact.consistent !== false && related.consistent !== false;

    return {
      classificationId,
      timestamp: new Date().toISOString(),
      consistent: fullyConsistent,
      exact,
      related
    };
  }
}

module.exports = new ClassificationEvidenceComparisonService();
module.exports.ClassificationEvidenceComparisonService = ClassificationEvidenceComparisonService;
module.exports.MISMATCH_REASON = MISMATCH_REASON;
