/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';

export const REPRESENTATIVE_MAX_GROUPS = 8;
export const REPRESENTATIVE_MAX_PASSES = 12;

export function representativeSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return Math.max(-1, Math.min(1, sum));
}

function meanDirection(items) {
  const sum = Array(items[0].vector.length).fill(0);
  for (const { vector } of items) for (let d = 0; d < sum.length; d++) sum[d] += vector[d];
  const norm = Math.sqrt(sum.reduce((total, value) => total + value * value, 0));
  return norm > 1e-12 ? sum.map(value => value / norm) : null;
}

async function checkpoint(index, signal) {
  if (index % 256 === 0) { await setImmediate(); signal?.throwIfAborted(); }
}

/** Internal normalized-vector geometry. Caller validates scope, vectors and work budget. */
export async function fitRepresentativeGeometry(items, { signal } = {}) {
  signal?.throwIfAborted();
  if (items.length < 3) return { groups: [], iterations: 0, converged: true, discarded: items.length };
  const count = Math.min(REPRESENTATIVE_MAX_GROUPS, Math.max(1, Math.floor(Math.sqrt(items.length / 3))));
  const mean = meanDirection(items) ?? items[0].vector;
  let first = 0;
  for (let i = 1; i < items.length; i++) {
    if (representativeSimilarity(items[i].vector, mean) > representativeSimilarity(items[first].vector, mean)) first = i;
  }
  const centers = [items[first].vector], closest = Array(items.length).fill(-Infinity);
  while (centers.length < count) {
    let farthest = 0;
    for (let i = 0; i < items.length; i++) {
      await checkpoint(i, signal);
      closest[i] = Math.max(closest[i], representativeSimilarity(items[i].vector, centers.at(-1)));
      if (closest[i] < closest[farthest]) farthest = i;
    }
    if (closest[farthest] >= 1 - 1e-12) break;
    centers.push(items[farthest].vector);
  }
  const labels = Array(items.length).fill(-1);
  let members, iterations = 0, converged = false;
  for (let pass = 0; pass < REPRESENTATIVE_MAX_PASSES; pass++) {
    members = centers.map(() => []);
    let changes = 0;
    for (let i = 0; i < items.length; i++) {
      await checkpoint(i, signal);
      let best = 0, similarity = -Infinity;
      for (let group = 0; group < centers.length; group++) {
        const score = representativeSimilarity(items[i].vector, centers[group]);
        if (score > similarity) { best = group; similarity = score; }
      }
      if (labels[i] !== best) changes++;
      labels[i] = best; members[best].push(items[i]);
    }
    iterations++;
    if (changes === 0) { converged = true; break; }
    for (let group = 0; group < centers.length; group++) {
      if (members[group].length) centers[group] = meanDirection(members[group]) ?? centers[group];
    }
  }
  const groups = members.flatMap(rows => {
    if (rows.length < 3) return [];
    const centroid = meanDirection(rows);
    if (!centroid) return [];
    const ranked = rows.map(row => ({ hash: row.hash, similarity: representativeSimilarity(row.vector, centroid) }))
      .sort((a, b) => b.similarity - a.similarity || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
    return [{ centroid, support: rows.length, representatives: ranked.slice(0, 3).map(row => row.hash),
      meanSimilarity: ranked.reduce((sum, row) => sum + row.similarity, 0) / ranked.length }];
  });
  return { groups, iterations, converged, discarded: items.length - groups.reduce((sum, group) => sum + group.support, 0) };
}
