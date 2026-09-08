/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const VERSION = 'library.observed_trait_prevalence.v1'
const MAX_LIBRARIES = 12
const MAX_ENTRIES = 5
const TRAIT_FIELDS = new Set(['rating', 'genres', 'studio', 'keywords', 'language'])
const MEDIA_TYPES = new Set(['movie', 'tv'])
const SCOPE_STATUSES = new Set(['complete_active_library_scope', 'partial_active_library_scope'])
const COVERAGE_STATUSES = new Set([
  'insufficient_local_coverage',
  'partial_local_coverage',
  'complete_local_coverage',
])

function boundedInteger(value, maximum) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= maximum ? numeric : null
}

function boundedPercent(value, minimum = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= 100
    ? Math.round(numeric * 10) / 10
    : null
}

function displayText(value) {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= 160 ? normalized : null
}

function normalizeEntry(value) {
  const entry = value && typeof value === 'object' ? value : null
  const localCount = boundedInteger(entry?.localCount, 20000)
  const peerCount = boundedInteger(entry?.peerCount, 20000)
  const localPercent = boundedPercent(entry?.localPercentOfObservedIdentities)
  const peerPercent = entry?.peerPercentOfObservedIdentities === null
    ? null
    : boundedPercent(entry?.peerPercentOfObservedIdentities)
  const difference = entry?.differencePercentPoints === null
    ? null
    : boundedPercent(entry?.differencePercentPoints, -100)

  if (!displayText(entry?.value) || localCount === null || peerCount === null || localPercent === null ||
      (entry?.peerPercentOfObservedIdentities !== null && peerPercent === null) ||
      (entry?.differencePercentPoints !== null && difference === null)) return null

  return {
    value: displayText(entry.value),
    localCount,
    localPercentOfObservedIdentities: localPercent,
    peerCount,
    peerPercentOfObservedIdentities: peerPercent,
    differencePercentPoints: difference,
  }
}

function normalizeTrait(value, entryLimit) {
  const trait = value && typeof value === 'object' ? value : null
  const sourceEntries = Array.isArray(trait?.entries) ? trait.entries : null
  const entries = sourceEntries ? sourceEntries.map(normalizeEntry) : []
  const valueCount = boundedInteger(trait?.valueCount, 20000)
  const localObservedIdentityCount = boundedInteger(trait?.localObservedIdentityCount, 20000)
  const localConflictingIdentityCount = boundedInteger(trait?.localConflictingIdentityCount, 20000)
  const localIdentityCount = boundedInteger(trait?.localIdentityCount, 20000)
  const peerObservedIdentityCount = boundedInteger(trait?.peerObservedIdentityCount, 20000)
  const peerKnownLibraryCount = boundedInteger(trait?.peerKnownLibraryCount, MAX_LIBRARIES - 1)

  if (!TRAIT_FIELDS.has(trait?.field) || !COVERAGE_STATUSES.has(trait?.status) || valueCount === null ||
      localObservedIdentityCount === null || localConflictingIdentityCount === null || localIdentityCount === null ||
      peerObservedIdentityCount === null || peerKnownLibraryCount === null || sourceEntries === null || entries.some((entry) => entry === null) || entries.length > entryLimit ||
      entries.length > valueCount || new Set(entries.map((entry) => entry.value)).size !== entries.length ||
      trait.truncated !== true && trait.truncated !== false ||
      localObservedIdentityCount + localConflictingIdentityCount > localIdentityCount ||
      entries.some((entry) => entry.localCount > localObservedIdentityCount || entry.peerCount > peerObservedIdentityCount)) {
    return null
  }

  return {
    field: trait.field,
    status: trait.status,
    localObservedIdentityCount,
    localConflictingIdentityCount,
    localIdentityCount,
    peerObservedIdentityCount,
    peerKnownLibraryCount,
    valueCount,
    truncated: trait.truncated === true,
    entries,
  }
}

function normalizeCohort(value, entryLimit) {
  const cohort = value && typeof value === 'object' ? value : null
  const sourceTraits = Array.isArray(cohort?.traits) ? cohort.traits : null
  const traits = sourceTraits ? sourceTraits.map((trait) => normalizeTrait(trait, entryLimit)) : []
  const peerCount = boundedInteger(cohort?.selectedPeerLibraryCount, MAX_LIBRARIES - 1)

  if (!MEDIA_TYPES.has(cohort?.mediaType) || peerCount === null || sourceTraits === null || traits.some((trait) => trait === null) || traits.length !== TRAIT_FIELDS.size ||
      new Set(traits.map((trait) => trait.field)).size !== TRAIT_FIELDS.size ||
      traits.some((trait) => trait.peerKnownLibraryCount > peerCount)) return null

  return { mediaType: cohort.mediaType, selectedPeerLibraryCount: peerCount, traits }
}

/** Only a bounded allow-list projection reaches the comparison disclosure. */
export function normalizeLibraryObservedTraitPrevalence(value) {
  const report = value && typeof value === 'object' ? value : null
  const entryLimit = boundedInteger(report?.entryLimit, MAX_ENTRIES)
  const selectedLibraryCount = boundedInteger(report?.selectedLibraryCount, MAX_LIBRARIES)
  const activeLibraryCount = boundedInteger(report?.activeLibraryCount, 2147483647)
  const libraries = Array.isArray(report?.libraries) ? report.libraries : []

  if (report?.version !== VERSION || !SCOPE_STATUSES.has(report?.scopeStatus) || entryLimit === null || entryLimit < 1 ||
      libraries.length > MAX_LIBRARIES || selectedLibraryCount !== libraries.length || activeLibraryCount === null ||
      activeLibraryCount < selectedLibraryCount ||
      (report.scopeStatus === 'complete_active_library_scope' && activeLibraryCount !== selectedLibraryCount) ||
      (report.scopeStatus === 'partial_active_library_scope' && activeLibraryCount <= selectedLibraryCount)) return null

  const normalizedLibraries = libraries.map((library) => {
    const libraryId = boundedInteger(library?.libraryId, 2147483647)
    const sourceCohorts = Array.isArray(library?.cohorts) ? library.cohorts : null
    const cohorts = sourceCohorts ? sourceCohorts.map((cohort) => normalizeCohort(cohort, entryLimit)) : []
    if (libraryId === null || libraryId < 1 || sourceCohorts === null || cohorts.some((cohort) => cohort === null) || cohorts.length > 2 ||
        new Set(cohorts.map((cohort) => cohort.mediaType)).size !== cohorts.length) return null
    return { libraryId, cohorts }
  })

  if (normalizedLibraries.some((library) => library === null) ||
      new Set(normalizedLibraries.map((library) => library.libraryId)).size !== normalizedLibraries.length) return null

  return {
    version: VERSION,
    scopeStatus: report.scopeStatus,
    entryLimit,
    libraries: normalizedLibraries,
  }
}
