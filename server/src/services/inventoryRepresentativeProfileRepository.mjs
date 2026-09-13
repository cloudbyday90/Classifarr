/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DESCRIPTION_CORPUS_SQL, prepareInventoryDescriptionCorpus, inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { createInventoryDescriptionVectorCache, validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from './inventoryDescriptionRefreshRepository.mjs';
import { REPRESENTATIVE_PROFILE_COMPONENT_LIMIT } from './inventoryRepresentativeProfile.mjs';

export const REPRESENTATIVE_PROFILE_LIBRARIES_SQL = `SELECT id, media_type FROM libraries
  WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65`;

// Novelty is broader than training: conflicted and descriptionless identities still count as seen.
export const REPRESENTATIVE_PROFILE_IDENTITIES_SQL = `SELECT DISTINCT msi.media_type, msi.tmdb_id
  FROM media_server_items msi JOIN libraries l ON l.id=msi.library_id AND l.is_active=true AND l.media_type=msi.media_type
  WHERE msi.media_type IN ('movie','tv') AND msi.tmdb_id > 0 ORDER BY msi.media_type, msi.tmdb_id LIMIT 50001`;

export function createInventoryRepresentativeProfileRepository({ withTransaction }) {
  return {
    async read(identity) {
      validateDescriptionRepresentation(identity);
      return withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout = '15s'");
        await client.query("SET LOCAL lock_timeout = '1s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
        await client.query("SET LOCAL transaction_timeout = '90s'");
        const state = (await client.query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL)).rows[0];
        const libraries = (await client.query(REPRESENTATIVE_PROFILE_LIBRARIES_SQL)).rows;
        if (libraries.length > 64) throw new Error('inventory_representative_library_budget');
        const identities = (await client.query(REPRESENTATIVE_PROFILE_IDENTITIES_SQL)).rows;
        if (identities.length > 50000) throw new Error('inventory_representative_identity_budget');
        const observedKeys = new Set(identities.map(inventoryDescriptionIdentity));
        const { rows } = await client.query(INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
        const corpus = prepareInventoryDescriptionCorpus(rows);
        if (corpus.texts.size * identity.dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT) {
          throw new Error('inventory_representative_vector_budget');
        }
        const cache = createInventoryDescriptionVectorCache({ query: (sql, params) => client.query(sql, params) });
        const vectors = await cache.read(identity, [...corpus.texts.keys()]);
        return { state, libraries, corpus, vectors, observedKeys };
      });
    },
  };
}
