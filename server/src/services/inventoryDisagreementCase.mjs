/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { summarizeProspectiveReferences } from './inventoryProspectiveReference.mjs';
import { inventoryShadowCandidateScore } from './inventoryRankingShadow.mjs';
import { prospectiveClassificationId, prospectiveTimestamp } from './inventoryProspectiveValues.mjs';
import { readPolicyEvaluationContext } from './policyEvaluationCaptureRead.mjs';

const compare = (prediction, assessment) => prediction === null ? 'abstained' : prediction === assessment ? 'agrees' : 'differs';

/** Allowlisted private fields only. Never spread a source row, capture or receipt into output. */
export function projectInventoryDisagreementCase(row, now) {
  const capture = row.capture, reference = summarizeProspectiveReferences(row.prepared.observations);
  const comparisons = {
    originalVersusAssessment: reference.original.status === 'available' ? compare(reference.original.libraryId, row.selectedLibraryId) : 'unavailable',
    baselineVersusAssessment: compare(capture.baselineLibraryId, row.selectedLibraryId),
    companyVersusAssessment: capture.companyAvailable ? compare(capture.combinedLibraryId, row.selectedLibraryId) : 'unavailable',
    experimentalArms: !capture.companyAvailable ? 'unavailable' : capture.baselineLibraryId === null && capture.combinedLibraryId === null
      ? 'abstained' : capture.baselineLibraryId === capture.combinedLibraryId ? 'agrees' : 'differs',
  };
  return {
    classificationId: prospectiveClassificationId(row.classification_id), mediaType: capture.mediaType,
    tmdbId: Number(capture.identityKey.split(':')[1]), recordedAt: new Date(prospectiveTimestamp(row.recorded_at)).toISOString(),
    capturedAt: new Date(capture.capturedAt).toISOString(), cohort: row.wasCorrection ? 'correction' : 'confirmation',
    assessment: { libraryId: row.selectedLibraryId, origins: reference.origins, referenceKinds: reference.referenceKinds },
    original: reference.original,
    experiment: { companyAvailable: capture.companyAvailable, baselineLibraryId: capture.baselineLibraryId,
      combinedLibraryId: capture.combinedLibraryId,
      alternatives: capture.candidates.map(candidate => ({ libraryId: candidate.libraryId,
        descriptionMean: candidate.descriptionMean, metadataFit: candidate.metadataFit, companyFit: candidate.companyFit,
        baselineScore: inventoryShadowCandidateScore(candidate), companyScore: inventoryShadowCandidateScore(candidate, true) }))
        .sort((a, b) => b.baselineScore - a.baselineScore || a.libraryId - b.libraryId) },
    policyEvaluation: readPolicyEvaluationContext(row, now),
    comparisons, flags: Object.keys(comparisons).filter(key => comparisons[key] === 'differs'),
  };
}
