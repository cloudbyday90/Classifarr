/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { readLibraryObservationTraits, buildLibraryProfileObservation, observationDistribution, observationStats } from './libraryProfileObservation.mjs';
import { INVENTORY_LEARNED_PROFILE_VERSION, learnInventoryProfiles, scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';

const keyOf = row => `${row.media_type}:${row.tmdb_id}`;

/** Allowlisted query content only; memberships, prior decisions and provider instructions are absent. */
export function projectFreshInventoryMetadata(row) {
  if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 500) return null;
  const traits = readLibraryObservationTraits({ ...row, metadata: row.evaluation_metadata });
  return { tmdb_id: row.tmdb_id, media_type: row.media_type, title: row.title,
    year: Number.isInteger(row.year) ? row.year : null, genres: [...traits.genres].sort(),
    keywords: [...traits.keywords].sort(), studio: traits.studio[0] ?? null,
    certification: traits.rating[0] ?? null, original_language: traits.language[0] ?? null };
}

/** Fold training never includes the query identity or any copy of its description. */
export function createFreshInventoryPolicyEvidence(snapshot, prepared) {
  const documents = new Map(snapshot.corpus.documents.map(doc => [doc.key, doc]));
  const metadata = new Map();
  for (const row of snapshot.evaluationRows) {
    const key = keyOf(row), projected = projectFreshInventoryMetadata(row);
    if (!metadata.has(key)) metadata.set(key, projected);
    else if (JSON.stringify(metadata.get(key)) !== JSON.stringify(projected)) metadata.set(key, null);
  }
  const folds = new Map();
  function context(entry) {
    const key = `${entry.foldIndex}:${entry.mediaType}`;
    if (folds.has(key)) return folds.get(key);
    const held = entry.heldDescriptionHashes;
    if (!(held instanceof Set) || !held.has(entry.descriptionHash)) throw new Error('fresh_policy_fold_missing');
    const training = snapshot.corpus.documents.filter(doc => doc.type === entry.mediaType && !held.has(doc.hash));
    const libraries = snapshot.libraries.filter(library => library.media_type === entry.mediaType);
    const learned = learnInventoryProfiles(training, snapshot.candidateMetadata, libraries);
    const profiles = new Map(libraries.map(library => {
      const rows = snapshot.evaluationRows.filter(row => row.library_id === library.id &&
        documents.has(keyOf(row)) && !held.has(documents.get(keyOf(row)).hash));
      const observation = buildLibraryProfileObservation(rows.map(row => ({ ...row, metadata: row.evaluation_metadata })));
      return [library.id, { profile: { media_type: library.media_type,
        rating_distribution: observationDistribution(observation, 'rating'),
        genre_distribution: observationDistribution(observation, 'genres'),
        keyword_distribution: observationDistribution(observation, 'keywords') },
      stats: observationStats(observation, null) }];
    }));
    const snapshotId = createHash('sha256').update(JSON.stringify([snapshot.fingerprint, key, [...held].sort()])).digest('hex');
    const value = { learned, profiles, snapshotId };
    folds.set(key, value);
    return value;
  }
  return {
    forCase(entry) {
      const queryKey = `${entry.mediaType}:${entry.itemIdentity.tmdbId}`;
      const query = metadata.get(queryKey);
      if (!query) return null;
      const doc = documents.get(queryKey);
      if (!doc || doc.hash !== entry.descriptionHash) throw new Error('fresh_policy_identity_mismatch');
      const { learned, profiles, snapshotId } = context(entry);
      return { metadata: { ...query, overview: entry.overview }, profiles,
        readProfile: async id => profiles.get(id)?.stats ?? null,
        retrieveCurrent: async () => null,
        async retrieve({ contract }) {
          if (!contract?.valid || !Array.isArray(contract.candidates) || contract.candidates.length > 64 ||
              new Set(contract.candidates.map(candidate => candidate.libraryId)).size !== contract.candidates.length) {
            return { statusId: 'unavailable', candidates: [] };
          }
          const poolIds = contract.candidates.map(candidate => candidate.libraryId);
          const candidates = contract.candidates.map(candidate => {
            const neighbors = entry.investigationCandidates.find(value => value.id === candidate.libraryId);
            if (!neighbors || candidate.mediaType !== entry.mediaType ||
                neighbors.items.some(item => entry.heldDescriptionHashes.has(item.hash))) return null;
            const relativeFit = Number(scoreInventoryProfile(learned, candidate.libraryId, snapshot.candidateMetadata.get(queryKey)).toFixed(4));
            return { libraryId: candidate.libraryId, eligible: neighbors.eligible, indexed: neighbors.eligible,
              learnedProfile: { version: INVENTORY_LEARNED_PROFILE_VERSION, snapshotId, relativeFit,
                statusId: relativeFit === 0 ? 'neutral' : 'available', trainingDescriptions: learned.summary.trainingDescriptions },
              items: neighbors.items.slice(0, 3).map(item => ({ description: prepared.texts.get(item.hash), similarity: item.similarity,
                sharedAcrossCandidates: poolIds.some(id => id !== candidate.libraryId && item.libraryIds.has(id)) })) };
          });
          return candidates.some(candidate => !candidate) ? { statusId: 'unavailable', candidates: [] }
            : { statusId: candidates.some(candidate => candidate.items.length) ? 'available' : 'unavailable', candidates };
        },
      };
    },
  };
}
