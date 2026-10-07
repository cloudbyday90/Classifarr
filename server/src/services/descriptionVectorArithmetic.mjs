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
  const result = [];
  for (let index = 0; index < vector.length; index++) result.push(vector[index] / norm);
  return result;
}

export function matchesNormalizedDescriptionVector(previous, vector, norm) {
  if (previous?.length !== vector.length) return false;
  for (let index = 0; index < vector.length; index++) {
    if (!Object.hasOwn(previous, index) || !Object.is(previous[index], vector[index] / norm)) return false;
  }
  return true;
}
