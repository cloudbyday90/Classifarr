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

import classificationEvidenceService from './classificationEvidenceService.mjs';
import classificationEvidenceRepository from './classificationEvidenceRepository.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationEvidenceComparisonService');

const MISMATCH_REASON = {
  MISSING_BACKFILL:    'missing_backfill',
  PROVENANCE_MISMATCH: 'provenance_mismatch',
  STATUS_MISMATCH:     'status_mismatch',
  NORMALIZATION:       'normalization_mismatch',
  EXTRA_IN_NEW:        'extra_evidence_candidate_not_used_by_legacy',
  LIBRARY_MISMATCH:    'library_id_mismatch'
};

class ClassificationEvidenceComparisonService {
  constructor(deps = {}) {
    this._evidenceService = deps.evidenceService || null;
    this._evidenceRepository = deps.evidenceRepository || null;
  }

  get evidenceService() {
    if (!this._evidenceService) {
      this._evidenceService = classificationEvidenceService;
    }
    return this._evidenceService;
  }

  get evidenceRepository() {
    if (!this._evidenceRepository) {
      this._evidenceRepository = classificationEvidenceRepository;
    }
    return this._evidenceRepository;
  }

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
        : newRow === null;

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

function createClassificationEvidenceComparisonService(deps = {}) {
  return new ClassificationEvidenceComparisonService(deps);
}

const classificationEvidenceComparisonService = new ClassificationEvidenceComparisonService();

export default classificationEvidenceComparisonService;
export { ClassificationEvidenceComparisonService, createClassificationEvidenceComparisonService, MISMATCH_REASON };
