/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_EVIDENCE_COVERAGE_VERSION = 'library.evidence_coverage.v2'

const isCount = value => Number.isSafeInteger(value) && value >= 0
const STATES = ['measured', 'no_inventory', 'inactive', 'unsupported_type', 'window_truncated']
const RETRIEVAL_STATES = ['disabled', 'unsupported_provider', 'model_unverified', 'recently_verified']
const SOURCE_EVIDENCE_FIELDS = ['typeMatchedItemCount', 'anchoredItemCount',
  'conflictBlockedItemCount', 'eligibleItemCount', 'describedItemCount',
  'missingDescriptionItemCount', 'describedWithoutTmdbItemCount',
  'alternateProviderObservedItemCount']

function parseSourceEvidence(value, source, inactive) {
  if (inactive) return value === null ? null : undefined
  if (value?.statusId === 'no_inventory') return source.itemCount === 0 ? { statusId: 'no_inventory' } : undefined
  if (value?.statusId === 'window_truncated') {
    return source.itemCount > 10000 ? { statusId: 'window_truncated' } : undefined
  }
  if (value?.statusId !== 'measured' || source.itemCount > 10000 ||
      !SOURCE_EVIDENCE_FIELDS.every(key => isCount(value[key])) ||
      value.typeMatchedItemCount > source.itemCount ||
      value.anchoredItemCount > value.typeMatchedItemCount ||
      value.conflictBlockedItemCount > value.anchoredItemCount ||
      value.eligibleItemCount !== value.anchoredItemCount - value.conflictBlockedItemCount ||
      value.describedItemCount + value.missingDescriptionItemCount !== value.eligibleItemCount ||
      value.describedWithoutTmdbItemCount > value.describedItemCount ||
      value.alternateProviderObservedItemCount > value.eligibleItemCount ||
      (source.excluded && value.typeMatchedItemCount !==
        source.itemCount - source.excluded.typeMismatch)) return undefined
  return { statusId: 'measured', ...Object.fromEntries(SOURCE_EVIDENCE_FIELDS.map(key => [key, value[key]])) }
}

export function parseLibraryEvidenceCoverage(value, expectedLibraryId) {
  if (value?.version !== LIBRARY_EVIDENCE_COVERAGE_VERSION ||
      !Number.isSafeInteger(value.libraryId) || value.libraryId < 1 ||
      (expectedLibraryId != null && value.libraryId !== Number(expectedLibraryId)) ||
      typeof value.asOf !== 'string' || !Number.isFinite(Date.parse(value.asOf)) ||
      (value.inventoryRevision != null && !/^[1-9]\d*$/.test(value.inventoryRevision)) ||
      typeof value.mediaType !== 'string' || value.mediaType.length > 32 ||
      !STATES.includes(value.statusId) || value.classificationQuality !== 'not_measured' ||
      !isCount(value.source?.itemCount)) return null
  const measured = value.statusId === 'measured'
  if (measured) {
    const source = value.source
    const excluded = source.excluded
    const description = value.description
    const retrieval = value.retrieval
    if (!['movie', 'tv'].includes(value.mediaType) ||
        !isCount(source.candidateRowCount) ||
        !['typeMismatch', 'missingIdentity', 'sourceConflict'].every(key => isCount(excluded?.[key])) ||
        source.candidateRowCount + excluded.typeMismatch + excluded.missingIdentity +
          excluded.sourceConflict !== source.itemCount ||
        !['candidateIdentityCount', 'usableIdentityCount', 'missingIdentityCount',
          'conflictingIdentityCount', 'uniqueDescriptionCount'].every(key => isCount(description?.[key])) ||
        description.candidateIdentityCount > source.candidateRowCount ||
        description.usableIdentityCount + description.missingIdentityCount +
          description.conflictingIdentityCount !== description.candidateIdentityCount ||
        description.uniqueDescriptionCount > description.usableIdentityCount ||
        !RETRIEVAL_STATES.includes(retrieval?.statusId) ||
        retrieval.eligibleIdentityCount !== description.usableIdentityCount) return null
    const verified = retrieval.statusId === 'recently_verified'
    if (verified ?
      !['indexedIdentityCount', 'retryDeferredIdentityCount', 'retryDueIdentityCount']
        .every(key => isCount(retrieval[key])) ||
        retrieval.indexedIdentityCount + retrieval.retryDeferredIdentityCount +
          retrieval.retryDueIdentityCount > retrieval.eligibleIdentityCount :
      ['indexedIdentityCount', 'retryDeferredIdentityCount', 'retryDueIdentityCount']
        .some(key => retrieval[key] !== null)) return null
  } else if (value.description !== null || value.retrieval !== null ||
      (['inactive', 'unsupported_type'].includes(value.statusId) ?
        value.source.candidateRowCount !== null || value.source.excluded !== null :
        !isCount(value.source.candidateRowCount) ||
          !['typeMismatch', 'missingIdentity', 'sourceConflict']
            .every(key => isCount(value.source.excluded?.[key])) ||
          value.source.candidateRowCount + value.source.excluded.typeMismatch +
            value.source.excluded.missingIdentity + value.source.excluded.sourceConflict !==
              value.source.itemCount ||
          (value.statusId === 'no_inventory' && value.source.itemCount !== 0) ||
          (value.statusId === 'window_truncated' && value.source.itemCount <= 10000))) return null
  const sourceEvidence = parseSourceEvidence(value.sourceEvidence, value.source,
    value.statusId === 'inactive')
  if (sourceEvidence === undefined ||
      (value.statusId === 'measured' && sourceEvidence?.statusId !== 'measured') ||
      (value.statusId === 'no_inventory' && sourceEvidence?.statusId !== 'no_inventory') ||
      (value.statusId === 'window_truncated' && sourceEvidence?.statusId !== 'window_truncated')) return null
  return {
    version: value.version, libraryId: value.libraryId, asOf: value.asOf,
    inventoryRevision: value.inventoryRevision, mediaType: value.mediaType,
    statusId: value.statusId, classificationQuality: 'not_measured',
    source: { itemCount: value.source.itemCount,
      candidateRowCount: value.source.candidateRowCount,
      excluded: value.source.excluded == null ? null : {
        typeMismatch: value.source.excluded.typeMismatch,
        missingIdentity: value.source.excluded.missingIdentity,
        sourceConflict: value.source.excluded.sourceConflict,
      } },
    sourceEvidence,
    description: value.description == null ? null : {
      candidateIdentityCount: value.description.candidateIdentityCount,
      usableIdentityCount: value.description.usableIdentityCount,
      missingIdentityCount: value.description.missingIdentityCount,
      conflictingIdentityCount: value.description.conflictingIdentityCount,
      uniqueDescriptionCount: value.description.uniqueDescriptionCount,
    },
    retrieval: value.retrieval == null ? null : {
      statusId: value.retrieval.statusId,
      eligibleIdentityCount: value.retrieval.eligibleIdentityCount,
      indexedIdentityCount: value.retrieval.indexedIdentityCount,
      retryDeferredIdentityCount: value.retrieval.retryDeferredIdentityCount,
      retryDueIdentityCount: value.retrieval.retryDueIdentityCount,
    },
  }
}
