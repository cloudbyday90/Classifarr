/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { descriptionTerms } from './inventoryGroupTermProfile.mjs';
import { validateCandidateLocalSupport } from './inventoryCandidateLocalEvidence.mjs';

/** Uncalibrated lexical proposal, with the existing local evidence consistency checks. */
export function resolveGroupTermEvidence(model, type, text, evidence, metadata) {
  const { candidates, complete, sharedMaximum } = evidence;
  if (!complete || candidates.some(row => row.items.length !== 3)) return { reason: 'group_incomplete_evidence' };
  const groups = model.filter(group => group.type === type), terms = descriptionTerms(text);
  if (candidates.some(row => !groups.some(group => group.id === row.id)) || groups.some(group => !group.weights.size)) {
    return { reason: 'group_incomplete_terms' };
  }
  const ranked = groups.map(group => {
    const matches = [...terms].filter(term => group.weights.has(term));
    return { ...group, matches: matches.length, score: matches.reduce((sum, term) => sum + group.weights.get(term), 0) / Math.sqrt(terms.size || 1) };
  }).sort((a, b) => b.score - a.score);
  const winner = ranked[0], rival = ranked.find(group => group.id !== winner.id);
  if (!winner || !rival || winner.matches < 2 || winner.score - rival.score <= 1e-12) return { reason: 'group_terms_not_distinct' };
  const index = candidates.findIndex(row => row.id === winner.id), items = candidates[index].items;
  if (items.some(item => item.group !== winner.group)) return { reason: 'group_neighbor_mismatch' };
  if (items[2].similarity <= 0 || items[2].similarity - sharedMaximum <= 1e-12) return { reason: 'group_shared_or_nonpositive' };
  return validateCandidateLocalSupport(evidence, index, metadata);
}

export function combineGroupTermEvidence(previous, proposal) {
  return previous.reason === 'local_overlapping_examples' ? proposal : previous;
}
