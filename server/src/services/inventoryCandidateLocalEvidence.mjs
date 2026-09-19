/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';

const EPSILON = 1e-12;
const CORRELATION_VETO = 0.98;
const abstain = reason => ({ reason });

function metadataScores(metadata, candidates) {
  const fields = [];
  if (metadata?.genres?.length) fields.push('genres');
  if (metadata?.studio) fields.push('studio');
  if (!fields.length) return null;
  const scores = candidates.map(candidate => fields.map(field => {
    const values = candidate.items.map(item => {
      if (field === 'studio') return item.metadata?.studio ? Number(item.metadata.studio === metadata.studio) : null;
      if (!item.metadata?.genres?.length) return null;
      const query = new Set(metadata.genres), example = new Set(item.metadata.genres);
      return [...query].filter(term => example.has(term)).length / new Set([...query, ...example]).size;
    });
    return values.includes(null) ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  }));
  return scores.some(row => row.includes(null)) ? null : scores;
}

/** Private, uncalibrated evidence proposal. Input comes only from the bounded fold-local retriever. */
export function resolveCandidateLocalEvidence(evidence, metadata) {
  const { candidates, complete, sharedMaximum } = evidence;
  if (!complete || candidates.some(row => row.items.length !== 3)) return abstain('local_incomplete_evidence');
  const ranked = candidates.map((row, index) => ({ index, score: row.items[2].similarity }))
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0], items = candidates[winner.index].items;
  if (winner.score <= 0) return abstain('local_no_positive_match');
  if (winner.score - sharedMaximum <= EPSILON || candidates.some((row, index) =>
    index !== winner.index && winner.score - row.items[0].similarity <= EPSILON)) return abstain('local_overlapping_examples');
  if (items[0].group === null || items.some(item => item.group !== items[0].group)) return abstain('local_unsupported_group');
  if (candidates.some(row => row.items[0].similarity >= CORRELATION_VETO) || sharedMaximum >= CORRELATION_VETO ||
      items.some((item, index) => items.slice(index + 1).some(other =>
        descriptionCosineSimilarity(item.vector, other.vector) >= CORRELATION_VETO))) return abstain('local_correlated_examples');
  const scores = metadataScores(metadata, candidates);
  if (!scores) return abstain('local_missing_metadata');
  const selected = scores[winner.index];
  if (scores.some((row, index) => index !== winner.index && (row.some((score, field) => score - selected[field] > EPSILON) ||
      !row.some((score, field) => selected[field] - score > EPSILON)))) return abstain('local_metadata_not_distinct');
  return { reason: 'selected', index: winner.index };
}

/** Only measured ambiguity can use this proposal; never override stable or unavailable evidence. */
export function combineCandidateLocalEvidence(baseline, proposal) {
  return ['initialization_sensitive', 'tied_destinations'].includes(baseline.reason) ? proposal : baseline;
}
