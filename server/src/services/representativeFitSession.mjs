/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';

export const REPRESENTATIVE_MAX_GROUPS = 8;
export const REPRESENTATIVE_MAX_PASSES = 12;
export const REPRESENTATIVE_STABILITY_PASSES = 64;
export const REPRESENTATIVE_RECOVERY_PASSES = 128;

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

function summarize(members, length, labels, iterations, converged, diagnostics, retainMemberships) {
  let objective = 0;
  const membership = { groups: [], unassigned: [] };
  const groups = members.flatMap(rows => {
    if (!rows.length) return [];
    const centroid = meanDirection(rows);
    if (centroid && diagnostics) objective += rows.reduce((sum, row) => sum + representativeSimilarity(row.vector, centroid), 0);
    if (!centroid || rows.length < 3) {
      if (retainMemberships) membership.unassigned.push(...rows.map(row => row.hash));
      return [];
    }
    if (retainMemberships) membership.groups.push(rows.map(row => row.hash));
    const ranked = rows.map(row => ({ hash: row.hash, similarity: representativeSimilarity(row.vector, centroid) }))
      .sort((a, b) => b.similarity - a.similarity || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
    return [{ centroid, support: rows.length, representatives: ranked.slice(0, 3).map(row => row.hash),
      meanSimilarity: ranked.reduce((sum, row) => sum + row.similarity, 0) / ranked.length }];
  });
  return { groups, iterations, converged, discarded: length - groups.reduce((sum, group) => sum + group.support, 0),
    ...(retainMemberships ? { membership } : {}),
    ...(diagnostics ? { objective: objective / length, labels: [...labels] } : {}) };
}

/** Worker-private continuation. Caller owns immutable, scoped, normalized input and work preflight. */
export function createRepresentativeFitSession(items, { signal, firstIndex = null, diagnostics = false, retainMemberships = false } = {}) {
  signal?.throwIfAborted();
  if (typeof retainMemberships !== 'boolean' ||
      (firstIndex !== null && (!Number.isSafeInteger(firstIndex) || firstIndex < 0 || firstIndex >= items.length))) {
    throw new Error('inventory_representative_fit_options');
  }
  let centers = [], labels = [], members = [], iterations = 0, converged = false, active = false, disposed = false;
  function release() { items = []; centers = []; labels = []; members = []; }
  function dispose() { disposed = true; if (!active) release(); }
  function check() {
    signal?.throwIfAborted();
    if (disposed) throw new Error('inventory_representative_fit_disposed');
  }
  // Call only at real yield boundaries; an async no-op still creates a promise/microtask per item.
  async function checkpoint() { await setImmediate(); check(); }
  async function seed() {
    const count = Math.min(REPRESENTATIVE_MAX_GROUPS, Math.max(1, Math.floor(Math.sqrt(items.length / 3))));
    const mean = meanDirection(items) ?? items[0].vector;
    let first = firstIndex ?? 0;
    if (firstIndex === null) for (let i = 1; i < items.length; i++) {
      if (i % 256 === 0) await checkpoint();
      if (representativeSimilarity(items[i].vector, mean) > representativeSimilarity(items[first].vector, mean)) first = i;
    }
    centers = [items[first].vector];
    const closest = Array(items.length).fill(-Infinity);
    while (centers.length < count) {
      let farthest = 0;
      for (let i = 0; i < items.length; i++) {
        if (i % 256 === 0) await checkpoint();
        closest[i] = Math.max(closest[i], representativeSimilarity(items[i].vector, centers.at(-1)));
        if (closest[i] < closest[farthest]) farthest = i;
      }
      if (closest[farthest] >= 1 - 1e-12) break;
      centers.push(items[farthest].vector);
    }
    labels = Array(items.length).fill(-1);
  }
  async function advance(passBudget) {
    if (!Number.isSafeInteger(passBudget) || passBudget < 1 || passBudget > REPRESENTATIVE_RECOVERY_PASSES) {
      throw new Error('inventory_representative_fit_options');
    }
    if (active) throw new Error('inventory_representative_fit_busy');
    active = true;
    try {
      check();
      if (items.length < 3) return { groups: [], iterations: 0, converged: true, discarded: items.length,
        ...(retainMemberships ? { membership: { groups: [], unassigned: items.map(row => row.hash) } } : {}),
        ...(diagnostics ? { objective: 0, labels: items.map(() => 0) } : {}) };
      if (!centers.length) await seed();
      const end = Math.min(REPRESENTATIVE_RECOVERY_PASSES, iterations + passBudget);
      while (!converged && iterations < end) {
        members = centers.map(() => []);
        let changes = 0;
        for (let i = 0; i < items.length; i++) {
          if (i % 256 === 0) await checkpoint();
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
      check();
      return summarize(members, items.length, labels, iterations, converged, diagnostics, retainMemberships);
    } catch (error) {
      dispose();
      throw error;
    } finally { active = false; if (disposed) release(); }
  }
  return { advance, dispose };
}
