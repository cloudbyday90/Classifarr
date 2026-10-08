/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Internal arithmetic for validated dense numeric arrays. Keep operation order:
// reciprocal multiplication, hypot and precision conversion change exact results.
export function descriptionVectorNorm(vector) {
  let sum = 0;
  for (let index = 0; index < vector.length; index++) {
    const value = vector[index];
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function divideDescriptionVector(vector, norm) {
  // Exact-sized backing storage avoids the spare capacity of repeated push.
  // Every slot is assigned before the result escapes.
  const result = new Array(vector.length);
  for (let index = 0; index < vector.length; index++) result[index] = vector[index] / norm;
  return result;
}

export function matchesNormalizedDescriptionVector(previous, vector, norm) {
  if (previous?.length !== vector.length) return false;
  for (let index = 0; index < vector.length; index++) {
    if (!Object.hasOwn(previous, index)) return false;
    const actual = previous[index], expected = vector[index] / norm;
    // Numeric SameValue avoids measured Object.is-path allocation in the pinned
    // runtime. Keep signed zero and NaN semantics; never coerce a borrowed value.
    if (actual === expected) {
      if (actual === 0 && 1 / actual !== 1 / expected) return false;
    } else if (!Number.isNaN(actual) || !Number.isNaN(expected)) return false;
  }
  return true;
}
