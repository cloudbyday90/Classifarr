/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';

export const COMMUNITY_NEIGHBORS = 16;
export const COMMUNITY_PAIR_BUDGET = 40_000_000_000;

function insertNeighbor(list, index, score) {
  if (score <= 0) return;
  let position = 0;
  while (position < list.length && (list[position].score > score ||
    (list[position].score === score && list[position].index < index))) position++;
  if (position >= COMMUNITY_NEIGHBORS) return;
  list.splice(position, 0, { index, score });
  if (list.length > COMMUNITY_NEIGHBORS) list.pop();
}

/** Exact streaming graph. No labels, raw content, all-pairs matrix or I/O. */
export async function buildLocalCommunityGraph(input, dimensions, signal) {
  signal?.throwIfAborted();
  if (!Array.isArray(input) || input.length > 10000 || !Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      input.length * dimensions > 8_000_000 || input.length * (input.length - 1) / 2 * dimensions > COMMUNITY_PAIR_BUDGET ||
      input.some(row => typeof row?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash)) ||
      new Set(input.map(row => row.hash)).size !== input.length) throw new Error('local_community_input_or_budget_invalid');
  const items = input.map(({ hash, vector }) => ({ hash, vector: normalizeDescriptionVector(vector, dimensions) }))
    .sort((a, b) => a.hash.localeCompare(b.hash));
  const neighbors = items.map(() => []);
  let pairs = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (pairs++ % 1024 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    const score = similarity(items[i].vector, items[j].vector);
    insertNeighbor(neighbors[i], j, score); insertNeighbor(neighbors[j], i, score);
  }
  const local = neighbors.map(list => new Map(list.filter(row => row.score >= list[Math.floor((list.length - 1) / 2)].score)
    .map(row => [row.index, row.score])));
  const edges = local.map((list, i) => new Map([...list].filter(([j]) => local[j].has(i))));
  signal?.throwIfAborted();
  return { items, edges, pairs, saturatedNeighborhoods: neighbors.filter(list => list.length === COMMUNITY_NEIGHBORS).length };
}
