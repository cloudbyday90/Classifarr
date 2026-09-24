/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NotFoundError } from '../utils/appError.mjs';
import { prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { createInventoryDescriptionVectorCache } from './inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionIsolationRepository } from './inventoryDescriptionIsolationRepository.mjs';
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { readCurrentDescriptionRepresentation } from './inventoryDescriptionRepresentationCheckpoint.mjs';
import { LIBRARY_EVIDENCE_COVERAGE_ROW_LIMIT,
  withLibraryEvidenceCoverageSnapshot } from './libraryEvidenceCoverageRepository.mjs';

export const LIBRARY_EVIDENCE_COVERAGE_VERSION = 'library.evidence_coverage.v1';

function count(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new TypeError('Invalid library evidence count');
  return parsed;
}

function revision(value) {
  if (value == null) return null;
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) throw new TypeError('Invalid library inventory revision');
  return text;
}

function retrievalStatus(config) {
  if (config?.rag_enabled !== true) return { statusId: 'disabled', configKey: null };
  try {
    return { statusId: 'enabled', configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(config)) };
  } catch {
    return { statusId: 'unsupported_provider', configKey: null };
  }
}

async function measureRetrieval(corpus, config, query) {
  const state = retrievalStatus(config);
  if (!state.configKey) return { statusId: state.statusId, eligibleIdentityCount: corpus.documents.length,
    indexedIdentityCount: null, retryDeferredIdentityCount: null, retryDueIdentityCount: null };
  const identity = await readCurrentDescriptionRepresentation(query, state.configKey);
  if (!identity) return { statusId: 'model_unverified', eligibleIdentityCount: corpus.documents.length,
    indexedIdentityCount: null, retryDeferredIdentityCount: null, retryDueIdentityCount: null };
  const hashes = [...corpus.texts.keys()];
  const present = await createInventoryDescriptionVectorCache({ query }).findPresent(identity, hashes);
  const pending = hashes.filter(hash => !present.has(hash));
  const journal = await createInventoryDescriptionIsolationRepository({ query }).read(identity, pending);
  return {
    statusId: 'recently_verified', eligibleIdentityCount: corpus.documents.length,
    indexedIdentityCount: corpus.documents.filter(doc => present.has(doc.hash)).length,
    retryDeferredIdentityCount: corpus.documents.filter(doc => !present.has(doc.hash) &&
      journal.get(doc.hash)?.due === false).length,
    retryDueIdentityCount: corpus.documents.filter(doc => !present.has(doc.hash) &&
      journal.get(doc.hash)?.due === true).length,
  };
}

/** Counts are scoped to one immutable inventory snapshot and never expose text or vectors. */
export async function readLibraryEvidenceCoverage(db, libraryId) {
  if (!Number.isSafeInteger(libraryId) || libraryId < 1) throw new TypeError('Invalid library ID');
  return withLibraryEvidenceCoverageSnapshot(db, libraryId, async ({ source, rows, config, query }) => {
    if (!source) throw new NotFoundError('Library not found');
    const itemCount = count(source.item_count);
    const base = {
      version: LIBRARY_EVIDENCE_COVERAGE_VERSION, libraryId,
      asOf: new Date(source.observed_at).toISOString(),
      inventoryRevision: revision(source.inventory_revision),
      mediaType: source.media_type, classificationQuality: 'not_measured',
    };
    if (source.is_active !== true || !['movie', 'tv'].includes(source.media_type)) {
      return { ...base, statusId: source.is_active ? 'unsupported_type' : 'inactive',
        source: { itemCount, candidateRowCount: null, excluded: null },
        description: null, retrieval: null };
    }
    const excluded = {
      typeMismatch: count(source.type_mismatch_count),
      missingIdentity: count(source.missing_identity_count),
      sourceConflict: count(source.source_conflict_count),
    };
    const candidateRowCount = itemCount - Object.values(excluded).reduce((sum, value) => sum + value, 0);
    if (candidateRowCount < 0) throw new TypeError('Inconsistent library evidence source counts');
    const sourceSummary = { itemCount, candidateRowCount, excluded };
    if (!itemCount) return { ...base, statusId: 'no_inventory', source: sourceSummary,
      description: null, retrieval: null };
    if (rows.length > LIBRARY_EVIDENCE_COVERAGE_ROW_LIMIT) {
      return { ...base, statusId: 'window_truncated', source: sourceSummary,
        description: null, retrieval: null };
    }
    if (rows.length !== candidateRowCount) throw new TypeError('Inconsistent library evidence corpus');
    const corpus = prepareInventoryDescriptionCorpus(rows);
    const coverage = corpus.coverage;
    if (coverage.eligibleIdentities + coverage.missingDescriptions +
        coverage.conflictingDescriptions !== coverage.identities) {
      throw new TypeError('Inconsistent library description coverage');
    }
    const description = {
      candidateIdentityCount: coverage.identities,
      usableIdentityCount: coverage.eligibleIdentities,
      missingIdentityCount: coverage.missingDescriptions,
      conflictingIdentityCount: coverage.conflictingDescriptions,
      uniqueDescriptionCount: coverage.uniqueDescriptions,
    };
    const retrieval = await measureRetrieval(corpus, config, query);
    if (retrieval.indexedIdentityCount != null &&
        retrieval.indexedIdentityCount + retrieval.retryDeferredIdentityCount +
        retrieval.retryDueIdentityCount > retrieval.eligibleIdentityCount) {
      throw new TypeError('Inconsistent library retrieval coverage');
    }
    return { ...base, statusId: 'measured', source: sourceSummary, description, retrieval };
  });
}
