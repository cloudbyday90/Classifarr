/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';

/** Only validated frozen context reaches this projection; History metadata is never a positive reference. */
export function prospectiveOriginalReference(context) {
  if (!context) return { status: 'not_captured', libraryId: null };
  if (context.capture.status !== 'completed') return { status: 'not_completed', libraryId: null };
  if (!CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method)) return { status: 'not_automated', libraryId: null };
  return { status: 'available', libraryId: context.capture.libraryId };
}

export function summarizeProspectiveReferences(observations) {
  const originals = observations.map(row => row.reference.original);
  const ids = new Set(originals.filter(value => value.status === 'available').map(value => value.libraryId));
  return {
    referenceKinds: [...new Set(observations.map(row => row.reference.kind))].sort(),
    origins: [...new Set(observations.map(row => row.reference.origin))].sort(),
    original: { status: ids.size > 1 ? 'conflicting' : ids.size ? 'available' : 'unavailable',
      libraryId: ids.size === 1 ? [...ids][0] : null,
      gaps: [...new Set(originals.filter(value => value.status !== 'available').map(value => value.status))].sort() },
  };
}
