/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

/** Synthetic vectors only: reproducible slow convergence, without media/library features. */
export function representativeFitFixture(seed = 68, count = 600, dimensions = 4) {
  let state = seed;
  return Array.from({ length: count }, (_, i) => {
    const vector = Array.from({ length: dimensions }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296 - 0.5;
    });
    const norm = Math.hypot(...vector);
    return { hash: createHash('sha256').update(String(i)).digest('hex'), vector: vector.map(value => value / norm) };
  }).sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
}
