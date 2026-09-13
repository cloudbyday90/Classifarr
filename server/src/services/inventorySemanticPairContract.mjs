/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const INVENTORY_SEMANTIC_PAIR_OUTPUT_TOKENS = 512;

export function buildInventoryPairResponseSchema(count) {
  if (!Number.isInteger(count) || count < 6 || count > 24 || count % 3) throw new Error('semantic_pair_count_invalid');
  return { type: 'object', properties: { grades: { type: 'array', minItems: count, maxItems: count,
    items: { type: 'integer', minimum: 0, maximum: 3 } } }, required: ['grades'], additionalProperties: false };
}

/** Exact small wire grammar rejects duplicate keys, extra prose, partial arrays and coercion. */
export function parseInventoryPairGrades(response, count) {
  buildInventoryPairResponseSchema(count);
  if (typeof response !== 'string' || response.length > 1024) return null;
  const compact = response.replace(/[ \t\r\n]/g, '');
  if (!/^\{"grades":\[[0-3](,[0-3]){5,23}\]\}$/.test(compact)) return null;
  try {
    const { grades } = JSON.parse(response);
    return Array.isArray(grades) && grades.length === count ? grades : null;
  } catch { return null; }
}

/** Ordinal grades rank evidence only. No probability or route permission is produced. */
export function chooseInventorySemanticCandidate(examples, grades) {
  buildInventoryPairResponseSchema(examples.length);
  if (!Array.isArray(grades) || grades.length !== examples.length || grades.some(grade => !Number.isInteger(grade) || grade < 0 || grade > 3)) {
    throw new Error('semantic_pair_grades_invalid');
  }
  const groups = new Map();
  for (const [index, example] of examples.entries()) {
    if (!Number.isSafeInteger(example.libraryId) || example.libraryId < 1) throw new Error('semantic_pair_scope_invalid');
    if (!groups.has(example.libraryId)) groups.set(example.libraryId, []);
    groups.get(example.libraryId).push(grades[index]);
  }
  if (groups.size < 2 || [...groups.values()].some(group => group.length !== 3)) throw new Error('semantic_pair_scope_invalid');
  const ranked = [...groups].map(([id, values]) => ({ id, sum: values.reduce((sum, grade) => sum + grade, 0),
    strong: values.filter(grade => grade >= 2).length })).sort((a, b) => b.sum - a.sum || a.id - b.id);
  return ranked[0].strong >= 2 && ranked[0].sum - ranked[1].sum >= 2 ? ranked[0].id : null;
}
