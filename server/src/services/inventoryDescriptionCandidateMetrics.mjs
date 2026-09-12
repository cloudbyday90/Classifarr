/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DESCRIPTION_ANCHOR_VERSION } from './inventoryDescriptionCandidateAnchor.mjs';

const unprotectedMatch = entry => entry.observedLibraryIds.some(id => entry.unprotectedCandidateIds.includes(id));
const protectedMatch = entry => entry.candidates.some(candidate => entry.observedLibraryIds.includes(candidate.id));
const summarize = cases => ({ requested: cases.length,
  changedShortlists: cases.filter(entry => entry.candidates.some(candidate => !entry.unprotectedCandidateIds.includes(candidate.id))).length,
  recoveredObservedDestinations: cases.filter(entry => !unprotectedMatch(entry) && protectedMatch(entry)).length,
  newObservedDestinationMisses: cases.filter(entry => unprotectedMatch(entry) && !protectedMatch(entry)).length,
  unprotectedPlacementMisses: cases.filter(entry => !unprotectedMatch(entry)).length,
  protectedPlacementMisses: cases.filter(entry => !protectedMatch(entry)).length,
});

/** Placement recall only, never accuracy; shared memberships may appear in multiple strata. */
export function summarizeDescriptionAnchorSelection(cases, libraries) {
  return { version: INVENTORY_DESCRIPTION_ANCHOR_VERSION, ...summarize(cases),
    media: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(cases.filter(entry => entry.mediaType === mediaType)) })),
    libraries: [...libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1,
      ...summarize(cases.filter(entry => entry.observedLibraryIds.includes(library.id))) })) };
}
