/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { OVERLAP_TRAITS, overlapPercent } from './libraryOverlapCohorts.mjs';

export const LIBRARY_OBSERVED_TRAIT_PREVALENCE_VERSION = 'library.observed_trait_prevalence.v1';
export const LIBRARY_OBSERVED_TRAIT_PREVALENCE_ENTRY_LIMIT = 5;

function sortedEntries(counts) {
  return [...counts.entries()]
    .sort(([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || leftValue.localeCompare(rightValue)
    );
}

function cohortCoverageStatus(cohort, trait) {
  if (trait.summary.observedIdentityCount === 0) return 'insufficient_local_coverage';
  if (cohort.summary.unidentifiedRowCount > 0 ||
      trait.summary.observedIdentityCount < cohort.identities.size ||
      trait.summary.conflictingIdentityCount > 0) {
    return 'partial_local_coverage';
  }
  return 'complete_local_coverage';
}

function peerFacts(cohorts, traitIndex) {
  const counts = new Map();
  let observedIdentityCount = 0;
  let knownLibraryCount = 0;

  cohorts.forEach((cohort) => {
    const trait = cohort.traits[traitIndex];
    if (trait.summary.observedIdentityCount > 0) knownLibraryCount++;
    observedIdentityCount += trait.summary.observedIdentityCount;
    trait.counts.forEach((count, value) => {
      counts.set(value, (counts.get(value) || 0) + count);
    });
  });

  return { counts, observedIdentityCount, knownLibraryCount };
}

function buildTraitPrevalence({ cohort, peerCohorts, traitIndex, entryLimit }) {
  const trait = cohort.traits[traitIndex];
  const peers = peerFacts(peerCohorts, traitIndex);
  const entries = sortedEntries(trait.counts);

  return {
    field: OVERLAP_TRAITS[traitIndex],
    status: cohortCoverageStatus(cohort, trait),
    localObservedIdentityCount: trait.summary.observedIdentityCount,
    localConflictingIdentityCount: trait.summary.conflictingIdentityCount,
    localIdentityCount: cohort.identities.size,
    peerObservedIdentityCount: peers.observedIdentityCount,
    peerKnownLibraryCount: peers.knownLibraryCount,
    valueCount: entries.length,
    truncated: entries.length > entryLimit,
    entries: entries.slice(0, entryLimit).map(([value, localCount]) => {
      const peerCount = peers.counts.get(value) || 0;
      const localPercentOfObservedIdentities = overlapPercent(localCount, trait.summary.observedIdentityCount);
      const peerPercentOfObservedIdentities = overlapPercent(peerCount, peers.observedIdentityCount);

      return {
        value,
        localCount,
        localPercentOfObservedIdentities,
        peerCount,
        peerPercentOfObservedIdentities,
        differencePercentPoints: peerPercentOfObservedIdentities === null
          ? null
          : Math.round((localPercentOfObservedIdentities - peerPercentOfObservedIdentities) * 10) / 10,
      };
    }),
  };
}

/**
 * Reports bounded observation prevalence for each selected library. This is
 * descriptive inventory evidence: it never establishes destination identity,
 * constraints, confidence, policy intent, or a routing decision.
 */
export function buildLibraryObservedTraitPrevalence({
  libraries = [],
  activeLibraryCount = 0,
  entryLimit = LIBRARY_OBSERVED_TRAIT_PREVALENCE_ENTRY_LIMIT,
} = {}) {
  const selectedLibraries = Array.isArray(libraries) ? libraries : [];
  const boundedEntryLimit = Number.isInteger(entryLimit) && entryLimit > 0
    ? Math.min(entryLimit, LIBRARY_OBSERVED_TRAIT_PREVALENCE_ENTRY_LIMIT)
    : LIBRARY_OBSERVED_TRAIT_PREVALENCE_ENTRY_LIMIT;
  const cohortsByType = new Map(['movie', 'tv'].map((mediaType) => [
    mediaType,
    selectedLibraries.flatMap((library) =>
      library.cohorts.filter((cohort) =>
        cohort.summary.mediaType === mediaType && cohort.summary.rowCount > 0
      )
    ),
  ]));
  const scopeStatus = activeLibraryCount === selectedLibraries.length
    ? 'complete_active_library_scope'
    : 'partial_active_library_scope';

  return {
    version: LIBRARY_OBSERVED_TRAIT_PREVALENCE_VERSION,
    scopeStatus,
    selectedLibraryCount: selectedLibraries.length,
    activeLibraryCount,
    entryLimit: boundedEntryLimit,
    libraries: selectedLibraries.map((library) => ({
      libraryId: library.id,
      cohorts: library.cohorts
        .filter((cohort) => cohort.summary.rowCount > 0)
        .map((cohort) => {
          const peers = cohortsByType.get(cohort.summary.mediaType)
            .filter((peer) => peer !== cohort);

          return {
            mediaType: cohort.summary.mediaType,
            selectedPeerLibraryCount: peers.length,
            traits: OVERLAP_TRAITS.map((_, traitIndex) => buildTraitPrevalence({
              cohort,
              peerCohorts: peers,
              traitIndex,
              entryLimit: boundedEntryLimit,
            })),
          };
        }),
    })),
  };
}
