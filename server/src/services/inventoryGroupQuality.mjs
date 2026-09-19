/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';

const round = value => Math.round(value * 1_000_000) / 1_000_000;
export function summarizeGroupValues(values) {
  if (!values.length) return { count: 0, mean: null, p10: null };
  const ordered = [...values].sort((a, b) => a - b);
  return { count: values.length, mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p10: round(ordered[Math.floor((ordered.length - 1) * 0.1)]) };
}

/** Geometry only, never semantic correctness. Caller supplies validated private partitions. */
export async function measureGroupQuality(groups, items, signal, { includeMargins = true } = {}) {
  const vectors = new Map(items.map(row => [row.hash, row.vector]));
  const cohesion = [], representation = [], margins = [], support = { threeToNine: 0, tenToFortyNine: 0, fiftyOrMore: 0 };
  let processed = 0;
  for (const group of groups) {
    support[group.support < 10 ? 'threeToNine' : group.support < 50 ? 'tenToFortyNine' : 'fiftyOrMore']++;
    const representatives = group.representatives.map(hash => vectors.get(hash));
    const alternatives = includeMargins ? groups.filter(other => other !== group) : [];
    for (const hash of group.hashes) {
      if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
      const vector = vectors.get(hash), own = similarity(vector, group.centroid);
      cohesion.push(own);
      representation.push(Math.max(...representatives.map(other => similarity(vector, other))));
      if (alternatives.length) margins.push(own - Math.max(...alternatives.map(other => similarity(vector, other.centroid))));
    }
  }
  signal?.throwIfAborted();
  return { groups: groups.length, trainingDescriptions: items.length, representedDescriptions: cohesion.length,
    unassignedDescriptions: items.length - cohesion.length, support, cohesion: summarizeGroupValues(cohesion),
    representation: summarizeGroupValues(representation), ownGroupMargin: summarizeGroupValues(margins),
    ...(!includeMargins ? { marginsMeasured: false } : {}) };
}

/** Preserve missing destinations as abstentions; this diagnostic is not a routing decision. */
export function compareNearestGroups(libraries, type, vector, observedIds) {
  const candidates = libraries.filter(row => row.mediaType === type);
  if (candidates.length < 2) return { reason: 'insufficient_candidates' };
  if (candidates.some(row => !row.available || !row.groups.length)) return { reason: 'unavailable_groups' };
  const ranked = candidates.map(row => ({ id: row.id, score: Math.max(...row.groups.map(group => similarity(vector, group.centroid))) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
  if (ranked[0].score <= 0 || ranked[0].score - ranked[1].score <= 1e-12) return { reason: 'ambiguous_groups' };
  return { reason: 'selected', id: ranked[0].id, agreement: observedIds.includes(ranked[0].id) };
}

/** Track the control's smallest supported group without treating small size as a semantic label. */
export function measureSmallGroupRetention(baseline, adaptive) {
  if (!baseline.length) return { groups: 0, descriptions: 0, retainedDescriptions: 0, intactGroups: 0, enlargedGroups: 0 };
  const minimum = Math.min(...baseline.map(group => group.support));
  const small = baseline.filter(group => group.support === minimum);
  const assigned = new Map(adaptive.flatMap((group, index) => group.hashes.map(hash => [hash, index])));
  let intactGroups = 0, enlargedGroups = 0;
  for (const group of small) {
    const index = assigned.get(group.hashes[0]);
    if (index !== undefined && group.hashes.every(hash => assigned.get(hash) === index)) {
      intactGroups++; enlargedGroups += Number(adaptive[index].support > group.support);
    }
  }
  return { groups: small.length, descriptions: small.reduce((sum, group) => sum + group.support, 0),
    retainedDescriptions: small.flatMap(group => group.hashes).filter(hash => assigned.has(hash)).length, intactGroups, enlargedGroups };
}
