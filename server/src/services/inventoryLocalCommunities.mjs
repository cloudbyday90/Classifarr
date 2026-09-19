/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { buildLocalCommunityGraph } from './localCommunityGraph.mjs';
import { groupDirection } from './adaptiveGroupSplit.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';

export function summarizeCommunity(items, centroid = groupDirection(items)) {
  const ranked = items.map(row => ({ hash: row.hash, score: similarity(row.vector, centroid) }))
    .sort((a, b) => b.score - a.score || a.hash.localeCompare(b.hash));
  return { centroid, support: items.length, hashes: items.map(row => row.hash),
    representatives: ranked.slice(0, 3).map(row => row.hash),
    meanSimilarity: ranked.reduce((sum, row) => sum + row.score, 0) / ranked.length };
}

/** Greedy complete-link proposals, then a deterministic non-overlapping partition. */
export async function fitLocalCommunities(input, dimensions, { signal } = {}) {
  const abort = AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
  const { items, edges, pairs, saturatedNeighborhoods } = await buildLocalCommunityGraph(input, dimensions, abort);
  const proposals = [];
  for (let i = 0; i < items.length; i++) {
    if (i % 64 === 0) { await setImmediate(); abort.throwIfAborted(); }
    const members = [i];
    for (const [j] of [...edges[i]].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
      if (members.every(member => edges[j].has(member))) members.push(j);
    }
    if (members.length >= 3) proposals.push(summarizeCommunity(members.map(index => items[index])));
  }
  proposals.sort((a, b) => b.support - a.support || b.meanSimilarity - a.meanSimilarity || a.hashes[0].localeCompare(b.hashes[0]));
  const byHash = new Map(items.map(row => [row.hash, row])), assigned = new Set(), groups = [];
  for (const [index, proposal] of proposals.entries()) {
    if (index % 64 === 0) { await setImmediate(); abort.throwIfAborted(); }
    const available = proposal.hashes.filter(hash => !assigned.has(hash));
    if (available.length < 3) continue;
    groups.push(summarizeCommunity(available.map(hash => byHash.get(hash))));
    available.forEach(hash => assigned.add(hash));
  }
  abort.throwIfAborted();
  return { groups, unassigned: items.filter(row => !assigned.has(row.hash)).map(row => row.hash),
    diagnostics: { pairs, proposals: proposals.length, saturatedNeighborhoods } };
}
