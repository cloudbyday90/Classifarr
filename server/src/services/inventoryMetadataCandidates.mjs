/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fuseInventoryCandidateRanks } from './inventoryCandidateRankFusion.mjs';
const clean = value => typeof value === 'string' && value.length <= 160
  ? value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().toLowerCase() : '';

/** Local inventory observations, never declared policy or model instructions. */
export function collectInventoryCandidateMetadata(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = `${row.media_type}:${row.tmdb_id}`;
    const value = { genres: [...new Set((Array.isArray(row.genres) ? row.genres.slice(0, 32) : []).map(clean).filter(Boolean))].sort(),
      studio: clean(row.studio), rating: clean(row.content_rating) };
    if (!result.has(key)) result.set(key, value);
    else if (JSON.stringify(result.get(key)) !== JSON.stringify(value)) result.set(key, null);
  }
  return result;
}

function similarity(query, example) {
  if (!query || !example) return 0;
  const intersection = query.genres.filter(genre => example.genres.includes(genre)).length;
  const union = new Set([...query.genres, ...example.genres]).size;
  // Ratings describe audience, not genre or library purpose; never rank by them.
  return (union ? intersection / union : 0) + Number(Boolean(query.studio) && query.studio === example.studio);
}

/** Fuse independent rankings; caller supplies same-media candidates and held-out examples. */
export function rankInventoryMetadataCandidates(ranked, query, examples) {
  if (!query) return ranked;
  const scored = ranked.map(candidate => {
    const unique = new Map();
    for (const example of examples.filter(entry => entry.libraryIds.includes(candidate.id))) {
      if (!unique.has(example.hash)) unique.set(example.hash, example);
      else if (JSON.stringify(unique.get(example.hash).metadata) !== JSON.stringify(example.metadata)) {
        unique.set(example.hash, { ...example, metadata: null });
      }
    }
    const scores = [...unique.values()]
      .map(example => similarity(query, example.metadata)).filter(score => score > 0).sort((a, b) => b - a).slice(0, 3);
    return { id: candidate.id, score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / 3 : 0 };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.id - b.id);
  return fuseInventoryCandidateRanks(ranked, scored);
}
