/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { compareInventoryDescriptionEvidence } from './inventoryDescriptionEvidenceComparison.mjs';

export const INVENTORY_CONFLICT_RECHECK_RULE = Object.freeze({
  version: 'inventory_evidence_conflict_v1', minimumMean: .65, minimumNeighbor: .60,
  similarityMargin: .02, relativeFitMargin: .25,
});

/** One correlated inventory signal, independent of names and observed placement. */
export function resolveInventoryEvidenceConflict({ proposedLibraryId, candidates } = {}) {
  const skip = reason => ({ shouldRecheck: false, reason });
  const compared = compareInventoryDescriptionEvidence(candidates);
  if (!compared) return skip('evidence_incomplete');
  const proposed = compared.find(entry => entry.candidate.libraryId === proposedLibraryId);
  if (!proposed) return skip('proposal_unavailable');
  const [alternative, ...others] = compared;
  const rule = INVENTORY_CONFLICT_RECHECK_RULE;
  if (alternative === proposed || proposed.profile.statusId !== 'available' || proposed.profile.relativeFit >= 0 ||
      alternative.profile.statusId !== 'available' || alternative.profile.relativeFit <= 0 ||
      alternative.mean < rule.minimumMean || alternative.candidate.items.some(item =>
        item.sharedAcrossCandidates !== false || item.similarity < rule.minimumNeighbor) ||
      others.some(other => alternative.mean - other.mean < rule.similarityMargin ||
        alternative.profile.relativeFit - other.profile.relativeFit < rule.relativeFitMargin)) return skip('no_joint_conflict');
  return { shouldRecheck: true, reason: 'joint_inventory_conflict', alternativeId: alternative.candidate.libraryId };
}

/** A recheck can only replace baseline with the preselected, in-scope alternative. */
export function selectInventoryConflictResult(baseline, recheck, decision) {
  return decision?.shouldRecheck === true && baseline?.status === 'proposed' &&
    recheck?.status === 'proposed' && recheck.destinationId === decision.alternativeId ? recheck : baseline;
}
