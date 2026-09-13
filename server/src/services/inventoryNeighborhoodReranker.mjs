/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { rankInventoryEvidence } from './inventoryEvidenceReranker.mjs';
import { scoreInventoryNeighborhoodProfiles } from './inventoryNeighborhoodProfiles.mjs';

/** Inspect only validated numeric evidence. Ties and absent positive support remain ambiguous. */
export function inventoryEvidenceLeaderState(candidates) {
  rankInventoryEvidence(candidates);
  const description = [...candidates].sort((a, b) => b.description - a.description);
  const metadata = [...candidates].sort((a, b) => b.profileFit - a.profileFit);
  if (metadata[0].profileFit <= 0 || description[0].description === description[1].description ||
      metadata[0].profileFit === metadata[1].profileFit) return 'ambiguous';
  return description[0].id === metadata[0].id ? 'consensus' : 'disagreement';
}

/** Local ranking is conditional inventory evidence, never an independent vote or route authority. */
export function rankInventoryNeighborhoodEvidence(index, row, queryMetadata) {
  const baseline = rankInventoryEvidence(row.candidates), state = inventoryEvidenceLeaderState(row.candidates);
  if (state !== 'disagreement') return { ranking: baseline, status: state, support: [] };
  const local = scoreInventoryNeighborhoodProfiles(index, row.entry, queryMetadata);
  if (local.status !== 'scored') return { ranking: baseline, status: local.status, support: local.support };
  const fits = new Map(local.scores.map(candidate => [candidate.id, candidate.profileFit]));
  if (fits.size !== row.candidates.length || row.candidates.some(candidate => !fits.has(candidate.id))) {
    throw new Error('inventory_neighborhood_score_scope_invalid');
  }
  return { ranking: rankInventoryEvidence(row.candidates.map(candidate => ({ ...candidate, profileFit: fits.get(candidate.id) }))),
    status: local.status, support: local.support };
}
