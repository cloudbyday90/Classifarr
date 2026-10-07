/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const VECTOR_VALIDATION_STUDY = Object.freeze({
  dimensions: 1024, count: 5776, batchSize: 256, conditioningCalls: 512, rounds: 3, deadlineMs: 60_000,
});

/** Fixed synthetic data only; no catalog, provider, credentials or caller payload. */
export function createVectorValidationFixture() {
  const { dimensions, batchSize } = VECTOR_VALIDATION_STUDY;
  const rows = Array.from({ length: batchSize }, (_, index) => ({
    description_hash: index.toString(16).padStart(64, '0'),
    embedding: JSON.stringify(Array.from({ length: dimensions }, (_, dimension) =>
      Math.fround(Math.sin((dimension + 1) * (1 + index % 10)) + 0.05 * Math.cos(dimension + 1 + index)))),
  }));
  return { rows, templates: rows.map(row => JSON.parse(row.embedding)) };
}
