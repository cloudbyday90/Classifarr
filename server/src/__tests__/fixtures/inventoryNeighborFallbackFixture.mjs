/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { learnedReviewFixture } from './learnedEvidenceReviewFixture.mjs';

export function neighborFallbackFixture() {
  const input = learnedReviewFixture();
  input.reviewEvidence.candidates[0].items[0].similarity = .90;
  const evidence = { proposal: { selected: 2, strict: false, shared: false }, calibration: {
    version: 'library_neighbor_cross_fit_v1', status: 'evaluated', snapshotId: 'a'.repeat(64),
    candidates: [1, 2, 3].map(libraryId => ({ libraryId, status: 'available', referenceComplete: true,
      referenceDescriptions: 25, calibrationDescriptions: 25, minimumCalibrationReferences: 24,
      calibrated: libraryId === 2 })) } };
  return { input, evidence };
}
