/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const VERSION = 'library.common_trait_evidence.v1'
const MAX_LIBRARIES = 12
const MAX_ENTRIES = 5
const TRAIT_FIELDS = new Set(['rating', 'genres', 'studio', 'keywords', 'language'])
const MEDIA_TYPES = new Set(['movie', 'tv'])
const SCOPE_STATUSES = new Set(['complete_active_library_scope', 'partial_active_library_scope'])
const TRAIT_STATUSES = new Set([
  'insufficient_selected_library_coverage',
  'insufficient_trait_coverage',
  'common_trait_evidence_available',
])

function boundedInteger(value, maximum) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= maximum ? numeric : null
}

function displayText(value) {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= 160 ? normalized : null
}

function normalizePolicyPurpose(value, observedLibraryCount) {
  const purpose = value && typeof value === 'object' ? value : null
  const noActive = boundedInteger(purpose?.noActiveValidatedPolicyLibraryCount, observedLibraryCount)
  const profileOnly = boundedInteger(purpose?.profileOnlySpecializedPurposeLibraryCount, observedLibraryCount)
  const noRetained = boundedInteger(purpose?.noRetainedDeclaredPurposeLibraryCount, observedLibraryCount)
  const retained = boundedInteger(purpose?.retainedDeclaredPurposeLibraryCount, observedLibraryCount)

  if ([noActive, profileOnly, noRetained, retained].some((count) => count === null) ||
      noActive + profileOnly + noRetained + retained !== observedLibraryCount) return null

  return {
    noActiveValidatedPolicyLibraryCount: noActive,
    profileOnlySpecializedPurposeLibraryCount: profileOnly,
    noRetainedDeclaredPurposeLibraryCount: noRetained,
    retainedDeclaredPurposeLibraryCount: retained,
  }
}

function normalizeEntry(value, { knownLibraryCount, includePolicyPurpose }) {
  const entry = value && typeof value === 'object' ? value : null
  const observedLibraryCount = boundedInteger(entry?.observedLibraryCount, knownLibraryCount)
  const matchingIdentityObservationCount = boundedInteger(entry?.matchingIdentityObservationCount, 20000)
  const policyPurpose = includePolicyPurpose
    ? normalizePolicyPurpose(entry?.policyPurpose, observedLibraryCount)
    : undefined

  if (!displayText(entry?.value) || observedLibraryCount === null || observedLibraryCount < 2 ||
      matchingIdentityObservationCount === null || matchingIdentityObservationCount < observedLibraryCount ||
      (includePolicyPurpose && policyPurpose === null)) return null

  return {
    value: displayText(entry.value),
    observedLibraryCount,
    matchingIdentityObservationCount,
    ...(includePolicyPurpose ? { policyPurpose } : {}),
  }
}

function normalizeTrait(value, { typedSelectedLibraryCount, entryLimit, includePolicyPurpose }) {
  const trait = value && typeof value === 'object' ? value : null
  const knownLibraryCount = boundedInteger(trait?.knownLibraryCount, typedSelectedLibraryCount)
  const commonValueCount = boundedInteger(trait?.commonValueCount, 20000)
  const sourceEntries = Array.isArray(trait?.entries) ? trait.entries : null
  const entries = sourceEntries
    ? sourceEntries.map((entry) => normalizeEntry(entry, { knownLibraryCount, includePolicyPurpose }))
    : []

  if (!TRAIT_FIELDS.has(trait?.field) || !TRAIT_STATUSES.has(trait?.status) ||
      trait?.typedSelectedLibraryCount !== typedSelectedLibraryCount || knownLibraryCount === null ||
      commonValueCount === null || sourceEntries === null || entries.some((entry) => entry === null) ||
      entries.length > entryLimit || entries.length > commonValueCount ||
      new Set(entries.map((entry) => entry.value)).size !== entries.length ||
      (trait.truncated !== true && trait.truncated !== false) ||
      (trait.status === 'insufficient_selected_library_coverage' && typedSelectedLibraryCount >= 2) ||
      (trait.status === 'insufficient_trait_coverage' &&
        (typedSelectedLibraryCount < 2 || knownLibraryCount >= 2)) ||
      (trait.status === 'common_trait_evidence_available' &&
        (typedSelectedLibraryCount < 2 || knownLibraryCount < 2)) ||
      entries.some((entry) => entry.observedLibraryCount > knownLibraryCount ||
        entry.matchingIdentityObservationCount < entry.observedLibraryCount)) return null

  return {
    field: trait.field,
    status: trait.status,
    typedSelectedLibraryCount,
    knownLibraryCount,
    commonValueCount,
    truncated: trait.truncated === true,
    entries,
  }
}

function normalizeGroup(value, { entryLimit, includePolicyPurpose }) {
  const group = value && typeof value === 'object' ? value : null
  const typedSelectedLibraryCount = boundedInteger(group?.typedSelectedLibraryCount, MAX_LIBRARIES)
  const sourceTraits = Array.isArray(group?.traits) ? group.traits : null
  const traits = sourceTraits
    ? sourceTraits.map((trait) => normalizeTrait(trait, {
      typedSelectedLibraryCount,
      entryLimit,
      includePolicyPurpose,
    }))
    : []

  if (!MEDIA_TYPES.has(group?.mediaType) || typedSelectedLibraryCount === null || sourceTraits === null ||
      traits.some((trait) => trait === null) || traits.length !== TRAIT_FIELDS.size ||
      new Set(traits.map((trait) => trait.field)).size !== TRAIT_FIELDS.size) return null

  return { mediaType: group.mediaType, typedSelectedLibraryCount, traits }
}

/** Only fixed, bounded observation aggregates reach the disclosure component. */
export function normalizeLibraryCommonTraitEvidence(value) {
  const report = value && typeof value === 'object' ? value : null
  const entryLimit = boundedInteger(report?.entryLimit, MAX_ENTRIES)
  const selectedLibraryCount = boundedInteger(report?.selectedLibraryCount, MAX_LIBRARIES)
  const activeLibraryCount = boundedInteger(report?.activeLibraryCount, 2147483647)
  const sourceGroups = Array.isArray(report?.groups) ? report.groups : null
  const includePolicyPurpose = report?.policyPurposeProvenanceIncluded === true
  const groups = sourceGroups
    ? sourceGroups.map((group) => normalizeGroup(group, { entryLimit, includePolicyPurpose }))
    : []

  if (report?.version !== VERSION || !SCOPE_STATUSES.has(report?.scopeStatus) || entryLimit === null || entryLimit < 1 ||
      selectedLibraryCount === null || activeLibraryCount === null || activeLibraryCount < selectedLibraryCount ||
      (report?.policyPurposeProvenanceIncluded !== true && report?.policyPurposeProvenanceIncluded !== false) ||
      sourceGroups === null || groups.length > 2 || groups.some((group) => group === null) ||
      new Set(groups.map((group) => group.mediaType)).size !== groups.length ||
      groups.some((group) => group.typedSelectedLibraryCount > selectedLibraryCount) ||
      (report.scopeStatus === 'complete_active_library_scope' && activeLibraryCount !== selectedLibraryCount) ||
      (report.scopeStatus === 'partial_active_library_scope' && activeLibraryCount <= selectedLibraryCount)) return null

  return {
    version: VERSION,
    scopeStatus: report.scopeStatus,
    entryLimit,
    policyPurposeProvenanceIncluded: includePolicyPurpose,
    groups,
  }
}
