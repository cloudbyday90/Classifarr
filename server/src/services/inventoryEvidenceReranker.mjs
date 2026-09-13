/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fuseInventoryCandidateRanks } from './inventoryCandidateRankFusion.mjs';

const recipes = new Map([
  ['baseline', null], ['balanced', [3, 1, 1, 1]], ['description_led', [6, 1, 1, 1]],
  ['description_only', [1, 0, 0, 0]], ['no_rating', [2, 1, 1, 0]],
]);
const channels = ['description', 'genres', 'studio', 'rating'];

/** Ranks only an already media/identity-scoped candidate pool. Never grants route authority. */
export function rankInventoryEvidence(candidates, recipe = 'baseline') {
  if (!recipes.has(recipe) || !Array.isArray(candidates) || candidates.length < 2 || candidates.length > 64 ||
      candidates.some(row => !row || typeof row !== 'object') ||
      new Set(candidates.map(row => row.id)).size !== candidates.length || candidates.some(row =>
        !Number.isSafeInteger(row.id) || row.id < 1 || !Number.isFinite(row.profileFit) ||
        !Number.isFinite(row.description) || row.description < -1 || row.description > 1 ||
        channels.slice(1).some(field => row[field] !== null && !Number.isFinite(row[field])))) {
    throw new Error('inventory_reranker_evidence_invalid');
  }
  const ordered = [...candidates].sort((a, b) => b.description - a.description || a.id - b.id);
  if (recipe === 'baseline') return fuseInventoryCandidateRanks(ordered,
    ordered.map(row => ({ id: row.id, score: row.profileFit }))).map(row => row.id);
  const active = channels.map((field, index) => ({ field, weight: recipes.get(recipe)[index] }))
    .filter(({ field, weight }) => weight > 0 && ordered.every(row => Number.isFinite(row[field])));
  return ordered.map((row, index) => ({ id: row.id, index, score: active.reduce((sum, { field, weight }) =>
    sum + weight / (61 + ordered.filter(other => other[field] > row[field]).length), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.id);
}

/** Select on inner validation only; weak placements never become verified labels. */
export function selectInventoryEvidenceRecipe(rows, libraryIds) {
  if (!Array.isArray(rows) || rows.length > 100 || !Array.isArray(libraryIds) || libraryIds.length > 64 ||
      new Set(libraryIds).size !== libraryIds.length || libraryIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error('inventory_reranker_training_invalid');
  }
  for (const row of rows) {
    if (!row || !Array.isArray(row.observedLibraryIds) || !row.observedLibraryIds.length ||
        row.observedLibraryIds.some(id => !libraryIds.includes(id)) || !Array.isArray(row.candidates) ||
        row.candidates.length !== libraryIds.length || row.candidates.some(candidate => !libraryIds.includes(candidate?.id))) {
      throw new Error('inventory_reranker_training_invalid');
    }
    rankInventoryEvidence(row.candidates);
  }
  const samples = libraryIds.map(id => rows.filter(row => row.observedLibraryIds.includes(id)));
  if (libraryIds.length < 2 || rows.length < 20 || samples.some(group => group.length < 3)) {
    return { recipe: 'baseline', status: 'insufficient_training', samples: rows.length };
  }
  let recipe = 'baseline', best = -1;
  for (const name of recipes.keys()) {
    const winners = new Map(rows.map(row => [row, rankInventoryEvidence(row.candidates, name)[0]]));
    const macro = samples.reduce((sum, group) => sum + group.filter(row =>
      row.observedLibraryIds.includes(winners.get(row))).length / group.length, 0) / samples.length;
    if (macro > best + 1e-12) { best = macro; recipe = name; }
  }
  return { recipe, status: 'selected', samples: rows.length };
}
