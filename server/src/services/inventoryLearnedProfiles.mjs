/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fuseInventoryCandidateRanks } from './inventoryCandidateRankFusion.mjs';

export const INVENTORY_LEARNED_PROFILE_VERSION = 'contrastive_profile_v1';
const fields = ['genres', 'studio', 'rating'];
const empty = () => Object.fromEntries(fields.map(field => [field, { total: 0, counts: new Map() }]));
const terms = (metadata, field) => [...new Set(field === 'genres' ? metadata?.genres ?? [] : metadata?.[field] ? [metadata[field]] : [])];

function observe(profile, metadata, weight, budget) {
  for (const field of fields) {
    const values = terms(metadata, field);
    if (!values.length) continue;
    profile[field].total += weight;
    for (const term of values) {
      if (!profile[field].counts.has(term) && ++budget.entries > 250000) throw new Error('inventory_profile_feature_budget');
      profile[field].counts.set(term, (profile[field].counts.get(term) ?? 0) + weight);
    }
  }
}

/** Caller supplies normalized private metadata; all held-out copies are excluded before fitting. */
export function learnInventoryProfiles(documents, metadata, libraries, heldHashes = new Set()) {
  if (documents.length > 50000 || libraries.length > 64) throw new Error('inventory_profile_budget');
  const profiles = new Map(libraries.map(library => [library.id, { mediaType: library.media_type, fields: empty() }]));
  const background = new Map(['movie', 'tv'].map(type => [type, empty()]));
  const budget = { entries: 0 };
  const groups = new Map();
  for (const doc of documents) {
    if (heldHashes.has(doc.hash)) continue;
    const key = `${doc.type}:${doc.hash}`, value = metadata?.get(doc.key) ?? null;
    if (!groups.has(key)) groups.set(key, { type: doc.type, metadata: value, libraries: new Set() });
    const group = groups.get(key);
    if (JSON.stringify(group.metadata) !== JSON.stringify(value)) group.metadata = null;
    for (const id of doc.libraryIds) if (profiles.get(id)?.mediaType === doc.type) group.libraries.add(id);
  }
  let trainingDescriptions = 0, sharedDescriptions = 0, missingOrConflictingMetadata = 0;
  for (const [, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!group.libraries.size) continue;
    if (!group.metadata || fields.every(field => !terms(group.metadata, field).length)) { missingOrConflictingMetadata++; continue; }
    trainingDescriptions++;
    if (group.libraries.size > 1) sharedDescriptions++;
    observe(background.get(group.type), group.metadata, 1, budget);
    for (const id of [...group.libraries].sort((a, b) => a - b)) observe(profiles.get(id).fields, group.metadata, 1 / group.libraries.size, budget);
  }
  return { profiles, background, summary: { version: INVENTORY_LEARNED_PROFILE_VERSION, trainingDescriptions,
    sharedDescriptions, missingOrConflictingMetadata,
    trainedLibraries: [...profiles.values()].filter(profile => fields.some(field => profile.fields[field].total > 0)).length } };
}

export function scoreInventoryProfile(model, libraryId, metadata) {
  const profile = model.profiles.get(libraryId);
  if (!profile || !metadata) return 0;
  const background = model.background.get(profile.mediaType);
  const scores = [];
  for (const field of fields) {
    const local = profile.fields[field], global = background[field];
    if (!local.total || global.total - local.total < 1) continue;
    // Universally observed traits carry no contrast, even with unequal library sizes.
    const values = terms(metadata, field).filter(term => global.counts.has(term) && global.counts.get(term) < global.total - 1e-9);
    if (!values.length) continue;
    scores.push(values.reduce((sum, term) => {
      const count = local.counts.get(term) ?? 0, all = global.counts.get(term);
      const inside = (count + 1) / (local.total + 2);
      const outside = (Math.max(0, all - count) + 1) / (Math.max(0, global.total - local.total) + 2);
      return sum + Math.log(inside / outside) * (all / (all + 3));
    }, 0) / values.length * (local.total / (local.total + 20)));
  }
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
}

export function rankInventoryLearnedCandidates(ranked, metadata, model) {
  return fuseInventoryCandidateRanks(ranked, ranked.map(candidate => ({ id: candidate.id, score: scoreInventoryProfile(model, candidate.id, metadata) })));
}
