/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLiveInventoryDescriptionCorpus } from './liveInventoryDescriptionCorpus.mjs';
import { buildLiveInventoryLearnedProfiles } from './liveInventoryLearnedProfile.mjs';
import { inventoryDescriptionQueryExcludedHashes } from './inventoryDescriptionQueryExclusions.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from './inventoryDescriptionRefreshRepository.mjs';
import { validateDescriptionRepresentation, createInventoryDescriptionVectorCache } from './inventoryDescriptionVectorCache.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { assessLiveLibraryMatch } from './liveLibraryMatchBaseline.mjs';
import { createLiveInventoryModelCache } from './liveInventoryModelCache.mjs';

export { LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL } from './liveInventoryDescriptionCorpus.mjs';

export const LIVE_INVENTORY_DESCRIPTION_RANK_SQL = `
  WITH membership AS (
    SELECT * FROM jsonb_to_recordset($5::jsonb) AS m(library_id integer, hash text)
  ), scored AS (
    SELECT m.library_id, m.hash, 1 - (c.embedding <=> $6::vector) AS similarity
    FROM membership m LEFT JOIN inventory_description_vector_cache c
      ON c.description_hash=m.hash AND c.projection_version=$1
      AND c.model_name=$2 AND c.model_digest=$3 AND c.dimensions=$4
      AND c.created_at > now() - interval '30 days'
  ), ranked AS (
    SELECT *, count(*) OVER (PARTITION BY library_id)::integer AS eligible,
      count(similarity) OVER (PARTITION BY library_id)::integer AS indexed,
      row_number() OVER (PARTITION BY library_id ORDER BY similarity DESC NULLS LAST, hash) AS position
    FROM scored
  ) SELECT library_id, hash, similarity, eligible, indexed FROM ranked
    WHERE position <= 3 ORDER BY library_id, position
`;

export function createLiveInventoryDescriptionRepository({ withTransaction,
  profileCache = createLiveInventoryModelCache({ maxWeight: 4 * 1024 * 1024 }),
  baselineCache = createLiveInventoryModelCache(),
}) {
  const snapshot = callback => withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
    return callback(client);
  });
  const query = (sql, parameters) => snapshot(client => client.query(sql, parameters));
  const cache = createInventoryDescriptionVectorCache({ query });
  return {
    async readConfig() {
      const { rows } = await query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL);
      return rows[0] ?? {};
    },
    async readQueryVector(identity, hash) {
      return (await cache.read(identity, [hash])).get(hash) ?? null;
    },
    async readLearnedProfiles({ request, signal }) {
      return snapshot(async client => {
        const source = await readLiveInventoryDescriptionCorpus(client, request, signal);
        const profiles = buildLiveInventoryLearnedProfiles({ ...source, request, modelCache: profileCache });
        signal?.throwIfAborted();
        return profiles;
      });
    },
    async retrieve({ request, identity, vector, signal }) {
      const representation = validateDescriptionRepresentation(identity);
      const encodedVector = JSON.stringify(validateEmbedding(vector, identity.dimensions));
      return snapshot(async client => {
        const { rows, corpus } = await readLiveInventoryDescriptionCorpus(client, request, signal);
        let learnedProfiles = new Map();
        try {
          if (request.queryMetadata) learnedProfiles = buildLiveInventoryLearnedProfiles({ rows, corpus, request, modelCache: profileCache });
        } catch {
          // A bounded profile failure must not discard otherwise usable description evidence.
        }
        const memberships = new Map(request.libraryIds.map(id => [id, new Set()]));
        const held = inventoryDescriptionQueryExcludedHashes(rows, request);
        for (const document of corpus.documents) {
          if (document.type !== request.mediaType || document.key === request.key || held.has(document.hash)) continue;
          for (const id of document.libraryIds) memberships.get(id)?.add(document.hash);
        }
        const scope = [...memberships].flatMap(([library_id, hashes]) => [...hashes].map(hash => ({ library_id, hash })));
        signal?.throwIfAborted();
        const ranked = scope.length ? (await client.query(LIVE_INVENTORY_DESCRIPTION_RANK_SQL,
          [...representation, JSON.stringify(scope), encodedVector])).rows : [];
        signal?.throwIfAborted();
        const matchBaseline = request.matchLibraryId == null ? null : await assessLiveLibraryMatch({
          rows, corpus, request, identity, vector, signal, modelCache: baselineCache,
          query: (sql, parameters) => client.query(sql, parameters),
        });
        return request.libraryIds.map(libraryId => {
          const matches = ranked.filter(row => row.library_id === libraryId);
          const items = matches.filter(row => row.similarity !== null).map(row => {
            if (!memberships.get(libraryId).has(row.hash) || !Number.isFinite(row.similarity)) {
              throw new Error('live_inventory_description_scope_invalid');
            }
            return { description: corpus.texts.get(row.hash), similarity: Math.max(-1, Math.min(1, row.similarity)),
              sharedAcrossCandidates: [...memberships.values()].filter(hashes => hashes.has(row.hash)).length > 1 };
          });
          return { libraryId, eligible: memberships.get(libraryId).size, indexed: matches[0]?.indexed ?? 0, items,
            ...(request.matchLibraryId != null ? { queryIdentityPresent: rows.some(row => row.library_id === libraryId &&
              `${row.media_type}:${row.tmdb_id}` === request.key) } : {}),
            ...(matchBaseline?.libraryId === libraryId ? { matchBaseline } : {}),
            ...(learnedProfiles.has(libraryId) ? { learnedProfile: learnedProfiles.get(libraryId) } : {}) };
        });
      });
    },
  };
}
