/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { OVERLAP_TRAITS } from './libraryOverlapCohorts.mjs';

export const LIBRARY_COMMON_TRAIT_EVIDENCE_VERSION = 'library.common_trait_evidence.v1';
export const LIBRARY_COMMON_TRAIT_EVIDENCE_ENTRY_LIMIT = 5;

const MEDIA_TYPES = ['movie', 'tv'];
const POLICY_PURPOSE_STATUSES = Object.freeze([
  'no_active_validated_native_policy',
  'profile_only_specialized_purpose',
  'no_retained_declared_purpose',
  'retained_declared_purpose_available',
]);

function boundedEntryLimit(value) {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, LIBRARY_COMMON_TRAIT_EVIDENCE_ENTRY_LIMIT)
    : LIBRARY_COMMON_TRAIT_EVIDENCE_ENTRY_LIMIT;
}

function emptyPurposeCounts() {
  return {
    noActiveValidatedPolicyLibraryCount: 0,
    profileOnlySpecializedPurposeLibraryCount: 0,
    noRetainedDeclaredPurposeLibraryCount: 0,
    retainedDeclaredPurposeLibraryCount: 0,
  };
}

function incrementPurposeCount(counts, statusId) {
  switch (statusId) {
    case 'no_active_validated_native_policy':
      counts.noActiveValidatedPolicyLibraryCount++;
      break;
    case 'profile_only_specialized_purpose':
      counts.profileOnlySpecializedPurposeLibraryCount++;
      break;
    case 'no_retained_declared_purpose':
      counts.noRetainedDeclaredPurposeLibraryCount++;
      break;
    case 'retained_declared_purpose_available':
      counts.retainedDeclaredPurposeLibraryCount++;
      break;
    default:
      break;
  }
}

function purposeCountsForLibraryIds(libraryIds, policyPurposeByLibrary) {
  const counts = emptyPurposeCounts();
  for (const libraryId of libraryIds) {
    const statusId = policyPurposeByLibrary.get(libraryId)?.statusId;
    if (POLICY_PURPOSE_STATUSES.includes(statusId)) incrementPurposeCount(counts, statusId);
  }
  return counts;
}

function sortableEntries(values) {
  return [...values.entries()].sort(([, left], [, right]) =>
    right.libraryIds.size - left.libraryIds.size ||
    right.matchingIdentityCount - left.matchingIdentityCount ||
    left.value.localeCompare(right.value)
  );
}

function traitEvidence({ cohorts, traitIndex, entryLimit, policyPurposeByLibrary }) {
  const traitName = OVERLAP_TRAITS[traitIndex];
  const knownCohorts = cohorts.filter((cohort) =>
    cohort.traits[traitIndex].summary.observedIdentityCount > 0
  );
  const values = new Map();

  for (const cohort of knownCohorts) {
    cohort.traits[traitIndex].counts.forEach((matchingIdentityCount, value) => {
      const entry = values.get(value) || {
        value,
        matchingIdentityCount: 0,
        libraryIds: new Set(),
      };
      entry.matchingIdentityCount += matchingIdentityCount;
      entry.libraryIds.add(cohort.libraryId);
      values.set(value, entry);
    });
  }

  const commonEntries = sortableEntries(new Map(
    [...values].filter(([, entry]) => entry.libraryIds.size >= 2)
  ));
  const status = cohorts.length < 2
    ? 'insufficient_selected_library_coverage'
    : knownCohorts.length < 2
      ? 'insufficient_trait_coverage'
      : 'common_trait_evidence_available';

  return {
    field: traitName,
    status,
    typedSelectedLibraryCount: cohorts.length,
    knownLibraryCount: knownCohorts.length,
    commonValueCount: commonEntries.length,
    truncated: commonEntries.length > entryLimit,
    entries: commonEntries.slice(0, entryLimit).map(([, entry]) => ({
      value: entry.value,
      observedLibraryCount: entry.libraryIds.size,
      matchingIdentityObservationCount: entry.matchingIdentityCount,
      ...(policyPurposeByLibrary instanceof Map ? {
        policyPurpose: purposeCountsForLibraryIds(entry.libraryIds, policyPurposeByLibrary),
      } : {}),
    })),
  };
}

/**
 * Reports repeated, conflict-excluded observations across selected libraries.
 * It is descriptive inventory evidence only: it cannot establish purpose,
 * policy authority, eligibility, confidence, classification, or routing.
 */
export function buildLibraryCommonTraitEvidence({
  libraries = [],
  activeLibraryCount = 0,
  entryLimit = LIBRARY_COMMON_TRAIT_EVIDENCE_ENTRY_LIMIT,
  policyPurposeByLibrary = null,
} = {}) {
  const selectedLibraries = Array.isArray(libraries) ? libraries : [];
  const boundedLimit = boundedEntryLimit(entryLimit);
  const includePolicyPurposeProvenance = policyPurposeByLibrary instanceof Map;
  const groups = MEDIA_TYPES.flatMap((mediaType) => {
    const cohorts = selectedLibraries.flatMap((library) => library.cohorts
      .filter((cohort) => cohort.summary.mediaType === mediaType && cohort.summary.rowCount > 0)
      .map((cohort) => ({ ...cohort, libraryId: library.id })));

    if (!cohorts.length) return [];
    return [{
      mediaType,
      typedSelectedLibraryCount: cohorts.length,
      traits: OVERLAP_TRAITS.map((_, traitIndex) => traitEvidence({
        cohorts,
        traitIndex,
        entryLimit: boundedLimit,
        policyPurposeByLibrary,
      })),
    }];
  });

  return {
    version: LIBRARY_COMMON_TRAIT_EVIDENCE_VERSION,
    scopeStatus: activeLibraryCount === selectedLibraries.length
      ? 'complete_active_library_scope'
      : 'partial_active_library_scope',
    selectedLibraryCount: selectedLibraries.length,
    activeLibraryCount,
    entryLimit: boundedLimit,
    policyPurposeProvenanceIncluded: includePolicyPurposeProvenance,
    groups,
  };
}
