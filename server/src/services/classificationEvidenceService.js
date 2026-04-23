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

const learningPatternEvidenceAdapter = require('./learningPatternEvidenceAdapter');
const discoveredPatternEvidenceAdapter = require('./discoveredPatternEvidenceAdapter');
const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const evidenceKeyBuilder = require('./classificationEvidenceKeyBuilder');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationEvidenceService');

// Maps legacy conflictMode strings to the repository's two-mode contract.
const REPO_CONFLICT_MODE = {
  do_nothing:      'do_nothing',
  update_metadata: 'update_data',
  update_payload:  'update_data'
};

class ClassificationEvidenceService {
  constructor(deps = {}) {
    this.learningPatternEvidenceAdapter =
      deps.learningPatternEvidenceAdapter || learningPatternEvidenceAdapter;
    this.discoveredPatternEvidenceAdapter =
      deps.discoveredPatternEvidenceAdapter || discoveredPatternEvidenceAdapter;
    this.evidenceRepository =
      deps.evidenceRepository || classificationEvidenceRepository;
  }

  async findExactMatch({ tmdbId, mediaType }) {
    // Phase 7: Read from new table first; fall back to legacy during compatibility window.
    const newRow = await this.evidenceRepository.findExactMatch({ tmdbId, mediaType });
    if (newRow) {
      return {
        matched: true,
        scope: 'item_exact',
        libraryId: newRow.library_id,
        confidence: newRow.confidence ?? 100,
        provenance: newRow.provenance,
        source: 'classification_evidence',
        mediaType: newRow.media_type || mediaType || null,
        updatedAt: newRow.updated_at || null
      };
    }
    // Compatibility fallback: legacy data not yet migrated to new table.
    return this.learningPatternEvidenceAdapter.findExactMatch({ tmdbId, mediaType });
  }

  async collectRelatedEvidence({
    metadata,
    candidateLibraryIds = null,
    includeDiscoveredPatterns = false,
    minDiscoveredPatternConfidence = 0
  }) {
    // Phase 7: default changed to false — stop classification-time dependence on discovered_patterns.
    const [learningEvidence, discoveredEvidence] = await Promise.all([
      this.learningPatternEvidenceAdapter.collectRelatedEvidence({ metadata, candidateLibraryIds }),
      includeDiscoveredPatterns
        ? this.discoveredPatternEvidenceAdapter.collectRelatedEvidence({
            metadata,
            minConfidence: minDiscoveredPatternConfidence
          })
        : Promise.resolve([])
    ]);

    return [...learningEvidence, ...discoveredEvidence].sort((left, right) => {
      const confidenceDelta = (right.confidence ?? 0) - (left.confidence ?? 0);
      if (confidenceDelta !== 0) return confidenceDelta;
      return (right.usageCount ?? 0) - (left.usageCount ?? 0);
    });
  }

  async purgeEvidence({ tmdbId, mediaType = null, scopes = [], client = null, actor = null, reason = null }) {
    // Phase 7: Primary delete from classification_evidence.
    const evidenceResult = await this.evidenceRepository.purgeByTmdbId({ tmdbId, mediaType, scopes, client });
    const evidenceDeleted = evidenceResult.deleted ?? 0;

    // Compatibility window: also purge from legacy table (best-effort) to keep data consistent.
    let legacyResult = { deleted: 0, deletedByScope: {} };
    try {
      legacyResult = await this.learningPatternEvidenceAdapter.purgeEvidence({ tmdbId, mediaType, scopes, client });
    } catch (err) {
      logger.warn('classificationEvidenceService.purgeEvidence: legacy purge failed', {
        tmdbId,
        mediaType,
        error: err.message
      });
    }

    // Build deletedByScope combining both tables so callers (e.g. retry service)
    // correctly detect a purge even during the compatibility window when only the
    // legacy table has data (backfill not yet run).
    const deletedByScope = {};
    const scopeList = scopes.length > 0 ? scopes : ['item_exact'];
    for (const s of scopeList) {
      const ceCount = evidenceDeleted;
      const legacyCount = legacyResult.deletedByScope?.[s] ?? 0;
      deletedByScope[s] = ceCount + legacyCount;
    }

    const totalDeleted = evidenceDeleted + (legacyResult.deleted ?? 0);

    return {
      deleted: totalDeleted,
      deletedByScope,
      classificationEvidence: { deleted: evidenceDeleted },
      actor,
      reason
    };
  }

  async listLegacyPatterns({ client = null } = {}) {
    return this.learningPatternEvidenceAdapter.listAll({ client });
  }

  async purgeAllLegacyPatterns({ client = null, actor = null, reason = null } = {}) {
    const legacyResult = await this.learningPatternEvidenceAdapter.purgeAll({ client });
    return {
      deleted: legacyResult.deleted,
      rows: legacyResult.rows,
      actor,
      reason
    };
  }

  async rememberExactMatch({
    tmdbId,
    mediaType,
    libraryId,
    payload = null,
    createdBy = null,
    client = null,
    _payloadColumn = 'metadata',
    conflictMode = 'do_nothing'
  }) {
    // Phase 7: Primary write to classification_evidence; stop writing to learning_patterns.
    if (!tmdbId || !libraryId) return null;

    const row = await this.evidenceRepository.upsertEvidence(
      {
        scope: 'item_exact',
        tmdbId,
        mediaType,
        libraryId,
        evidenceKey: null,
        evidenceData: payload,
        confidence: 100,
        usageCount: 0,
        successRate: null,
        provenance: 'human_confirmed',
        status: 'active',
        createdBy,
        sourceSystem: 'learning_patterns'
      },
      { client, conflictMode: REPO_CONFLICT_MODE[conflictMode] ?? 'do_nothing' }
    );
    return row;
  }

  async reinforceGenrePatterns({
    mediaType,
    libraryId,
    genres,
    createdBy,
    client = null
  }) {
    // Phase 7: Primary write to classification_evidence; stop writing to learning_patterns.
    const normalizedGenres = normalizeMetadataListLower(genres);
    const touched = [];

    for (const genreLower of normalizedGenres) {
      try {
        await this.evidenceRepository.upsertEvidence(
          {
            scope: 'genre',
            tmdbId: null,
            mediaType,
            libraryId,
            evidenceKey: evidenceKeyBuilder.buildSingleGenreKey(genreLower),
            evidenceData: null,
            confidence: 85,
            usageCount: 0,
            successRate: null,
            provenance: 'policy_confirmed',
            status: 'active',
            createdBy,
            sourceSystem: 'learning_patterns'
          },
          { client, conflictMode: 'update_data' }
        );
        touched.push(genreLower);
      } catch (err) {
        logger.warn('classificationEvidenceService.reinforceGenrePatterns: upsert failed', {
          genre: genreLower,
          libraryId,
          error: err.message
        });
      }
    }

    return touched;
  }

  async restoreLegacyPattern({ pattern, libraryId, client = null }) {
    return this.learningPatternEvidenceAdapter.restoreLegacyPattern({
      pattern,
      libraryId,
      client
    });
  }

  /**
   * Summarise a related-evidence array for use in AI prompts and clarification question builders.
   * Informational-only — policy scores remain authoritative.
   *
   * @param {object[]} evidence  - from collectRelatedEvidence()
   * @param {object[]} libraries - active libraries for this media type
   * @returns {{ topLibrary, confidence, topScopes, hasConflict }|null}
   */
  buildRelatedEvidenceSummary(evidence, libraries) {
    if (!Array.isArray(evidence) || evidence.length === 0) return null;

    const sorted = [...evidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const top = sorted[0];
    const topLibraryObj = top?.libraryId
      ? (libraries || []).find(l => l.id === top.libraryId)
      : null;
    const topLibrary = topLibraryObj?.name ?? null;
    const topScopes = sorted.slice(0, 5).map(e => ({
      scope: e.scope,
      label: e.evidenceData?.genre ?? e.evidenceData?.studio ?? e.evidenceData?.franchise ?? e.evidenceKey ?? e.scope,
      confidence: e.confidence ?? 0,
      provenance: e.provenance ?? null,
    }));
    const uniqueLibraryIds = new Set(sorted.map(e => e.libraryId).filter(Boolean));
    const hasConflict = uniqueLibraryIds.size > 1;

    return { topLibrary, confidence: top?.confidence ?? 0, topScopes, hasConflict };
  }
}

module.exports = new ClassificationEvidenceService();
module.exports.ClassificationEvidenceService = ClassificationEvidenceService;
