/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { compareInventoryDescriptionEvidence } from './inventoryDescriptionEvidenceComparison.mjs';

/** One correlated inventory comparison, never a probability or routing grant. */
export function assessInventoryDescriptionSeparation(candidates) {
  const reject = reason => ({ eligible: false, reason });
  const compared = compareInventoryDescriptionEvidence(candidates);
  if (!compared) return reject('evidence_incomplete');
  const [winner, ...others] = compared;
  if (winner.profile.statusId !== 'available' || winner.profile.relativeFit <= 0 ||
      winner.candidate.items.some(item => item.sharedAcrossCandidates !== false || item.similarity < .75) ||
      winner.mean < .80 || others.some(other => winner.mean - other.mean < .05 ||
        other.profile.relativeFit >= winner.profile.relativeFit)) return reject('evidence_ambiguous');
  return { eligible: true, reason: 'distinct_inventory_support', libraryId: winner.candidate.libraryId,
    comparison: { schema_version: 1, status_id: 'distinct_support', compared_libraries: compared.length,
      neighbors: 3, mean_similarity: Number(winner.mean.toFixed(6)),
      similarity_margin: Number((winner.mean - others[0].mean).toFixed(6)),
      relative_fit: winner.profile.relativeFit, training_descriptions: winner.profile.trainingDescriptions } };
}
