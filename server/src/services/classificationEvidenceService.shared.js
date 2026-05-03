/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unified evidence service across legacy patterns and classification_evidence.
 */

const learningPatternEvidenceAdapter = require('./learningPatternEvidenceAdapter.shared');
const discoveredPatternEvidenceAdapter = require('./discoveredPatternEvidenceAdapter.shared');
const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const classificationEvidenceKeyBuilder = require('./classificationEvidenceKeyBuilder');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationEvidenceService');

const REPO_CONFLICT_MODE = {
  do_nothing: 'do_nothing',
  update_metadata: 'update_data',
  update_payload: 'update_data'
};

class ClassificationEvidenceService {
  constructor(deps = {}) {
    this.learningPatternEvidenceAdapter =
      deps.learningPatternEvidenceAdapter || learningPatternEvidenceAdapter;
    this.discoveredPatternEvidenceAdapter =
      deps.discoveredPatternEvidenceAdapter || discoveredPatternEvidenceAdapter;
    this.evidenceRepository =
      deps.evidenceRepository || classificationEvidenceRepository;
    this.evidenceKeyBuilder =
      deps.evidenceKeyBuilder || classificationEvidenceKeyBuilder;
  }

  async findExactMatch({ tmdbId, mediaType }) {
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

    return this.learningPatternEvidenceAdapter.findExactMatch({ tmdbId, mediaType });
  }

  async collectRelatedEvidence({
    metadata,
    candidateLibraryIds = null,
    includeDiscoveredPatterns = false,
    minDiscoveredPatternConfidence = 0
  }) {
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
    const evidenceResult = await this.evidenceRepository.purgeByTmdbId({ tmdbId, mediaType, scopes, client });
    const evidenceDeleted = evidenceResult.deleted ?? 0;

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

    const deletedByScope = {};
    const scopeList = scopes.length > 0 ? scopes : ['item_exact'];
    for (const scope of scopeList) {
      const legacyCount = legacyResult.deletedByScope?.[scope] ?? 0;
      deletedByScope[scope] = evidenceDeleted + legacyCount;
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
    if (!tmdbId || !libraryId) return null;

    return this.evidenceRepository.upsertEvidence(
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
  }

  async reinforceGenrePatterns({
    mediaType,
    libraryId,
    genres,
    createdBy,
    client = null
  }) {
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
            evidenceKey: this.evidenceKeyBuilder.buildSingleGenreKey(genreLower),
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

  buildRelatedEvidenceSummary(evidence, libraries) {
    if (!Array.isArray(evidence) || evidence.length === 0) return null;

    const sorted = [...evidence].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0));
    const top = sorted[0];
    const topLibraryObj = top?.libraryId
      ? (libraries || []).find((library) => library.id === top.libraryId)
      : null;
    const topLibrary = topLibraryObj?.name ?? null;
    const topScopes = sorted.slice(0, 5).map((entry) => ({
      scope: entry.scope,
      label: entry.evidenceData?.genre || entry.evidenceData?.studio || entry.evidenceData?.franchise || entry.evidenceKey || entry.scope,
      confidence: entry.confidence ?? 0,
      provenance: entry.provenance ?? null,
    }));
    const uniqueLibraryIds = new Set(sorted.map((entry) => entry.libraryId).filter(Boolean));
    const hasConflict = uniqueLibraryIds.size > 1;

    return { topLibrary, confidence: top?.confidence ?? 0, topScopes, hasConflict };
  }
}

const classificationEvidenceService = new ClassificationEvidenceService();

module.exports = classificationEvidenceService;
module.exports.ClassificationEvidenceService = ClassificationEvidenceService;
module.exports.default = classificationEvidenceService;
