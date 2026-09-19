/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';
import { fitLocalCommunities, summarizeCommunity } from './inventoryLocalCommunities.mjs';

/** Placement is inspected only after the content-only discovery fit. */
export async function discoverCommunityParticipation(index, vectors, dimensions, signal) {
  const libraries = [...index.scope].map(([id, mediaType]) => ({ id, mediaType, available: false, groups: [] }));
  const media = new Map();
  for (const type of ['movie', 'tv']) {
    const rows = [...index.groups.values()].filter(row => row.type === type)
      .map(row => ({ hash: row.hash, vector: normalizeDescriptionVector(vectors.get(row.hash), dimensions), libraries: row.libraries }));
    const byHash = new Map(rows.map(row => [row.hash, row]));
    const fitted = await fitLocalCommunities(rows.map(({ hash, vector }) => ({ hash, vector })), dimensions, { signal });
    const projected = new Set(), assigned = new Set(fitted.groups.flatMap(group => group.hashes));
    for (const group of fitted.groups) {
      const participants = new Map();
      for (const hash of group.hashes) {
        const row = byHash.get(hash);
        if (row.libraries.size !== 1) continue;
        const id = [...row.libraries][0];
        if (!participants.has(id)) participants.set(id, []);
        participants.get(id).push(row);
      }
      for (const [id, items] of participants) if (items.length >= 3) {
        const library = libraries.find(row => row.id === id);
        library.groups.push(summarizeCommunity(items, group.centroid)); library.available = true;
        items.forEach(row => projected.add(row.hash));
      }
    }
    media.set(type, { rows, fitted, projected, assigned,
      sharedDescriptions: rows.filter(row => row.libraries.size > 1).length,
      sharedAssigned: rows.filter(row => row.libraries.size > 1 && assigned.has(row.hash)).length });
  }
  return { libraries, media };
}

/** Keep missing/shared nearest evidence from becoming a silent advantage. */
export function communityEvidenceDecision(media, vector, geometry) {
  if (geometry.reason !== 'selected') return geometry;
  let nearest, best = -Infinity, second = -Infinity;
  for (const row of media.rows) {
    const score = similarity(vector, row.vector);
    if (score > best) { second = best; nearest = row; best = score; }
    else if (score > second) second = score;
  }
  if (!nearest || best <= 0 || best - second <= 1e-12) return { reason: 'ambiguous_nearest' };
  if (nearest.libraries.size > 1) return { reason: 'shared_nearest' };
  if (!media.assigned.has(nearest.hash)) return { reason: 'unassigned_nearest' };
  if (!media.projected.has(nearest.hash)) return { reason: 'unsupported_participation' };
  return geometry;
}
