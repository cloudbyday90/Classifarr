/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryDescriptionCorpusSql, prepareInventoryDescriptionCorpus, inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { collectInventoryObservationReadiness } from './inventoryObservationReadiness.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { createInventoryDescriptionVectorCache, validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { readInventoryDescriptionVectors } from './inventoryDescriptionVectorReader.mjs';
import { fingerprintMultiScaleVerification } from './inventoryMultiScaleVerification.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from './inventoryDescriptionRefreshRepository.mjs';
import { REPRESENTATIVE_PROFILE_COMPONENT_LIMIT } from './inventoryRepresentativeProfile.mjs';

export const REPRESENTATIVE_PROFILE_LIBRARIES_SQL = `SELECT id, media_type FROM libraries
  WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65`;

export const REPRESENTATIVE_PROFILE_CORPUS_SQL = buildInventoryDescriptionCorpusSql({ includeReadinessMetadata: true });

// Novelty is broader than training: conflicted and descriptionless identities still count as seen.
export const REPRESENTATIVE_PROFILE_IDENTITIES_SQL = `SELECT DISTINCT msi.media_type, msi.tmdb_id
  FROM media_server_items msi JOIN libraries l ON l.id=msi.library_id AND l.is_active=true AND l.media_type=msi.media_type
  WHERE msi.media_type IN ('movie','tv') AND msi.tmdb_id > 0 ORDER BY msi.media_type, msi.tmdb_id LIMIT 50001`;

export function createInventoryRepresentativeProfileRepository({ withTransaction }) {
  const readSnapshot = async (identity, { requireCompleteVectors = false, signal } = {}, verification = false) => {
    validateDescriptionRepresentation(identity);
    signal?.throwIfAborted();
    const source = await withTransaction(async client => {
      const query = async (...args) => {
        signal?.throwIfAborted();
        const result = await client.query(...args);
        signal?.throwIfAborted();
        return result;
      };
      await query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await query("SET LOCAL statement_timeout = '15s'");
      await query("SET LOCAL lock_timeout = '1s'");
      await query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
      await query("SET LOCAL transaction_timeout = '90s'");
      const state = (await query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL)).rows[0];
      const libraries = (await query(REPRESENTATIVE_PROFILE_LIBRARIES_SQL)).rows;
      if (libraries.length > 64) throw new Error('inventory_representative_library_budget');
      const identities = (await query(REPRESENTATIVE_PROFILE_IDENTITIES_SQL)).rows;
      if (identities.length > 50000) throw new Error('inventory_representative_identity_budget');
      const { rows } = await query(REPRESENTATIVE_PROFILE_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
      const corpus = prepareInventoryDescriptionCorpus(rows);
      if (corpus.texts.size * identity.dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT) {
        throw new Error('inventory_representative_vector_budget');
      }
      const hashes = [...corpus.texts.keys()];
      if (requireCompleteVectors) {
        const present = await createInventoryDescriptionVectorCache({ query }).findPresent(identity, hashes);
        if (present.size !== hashes.length) {
          throw Object.assign(new Error('multi_scale_complete_cache_required'), { coverage: {
            eligibleDescriptions: hashes.length, cachedDescriptions: present.size,
            missingDescriptions: hashes.length - present.size,
          } });
        }
      }
      const evidence = verification
        ? { key: await fingerprintMultiScaleVerification(query, identity, { libraries, corpus }, signal) }
        : { vectors: await readInventoryDescriptionVectors(query, identity, hashes, { signal }) };
      return { state, libraries, corpus, ...evidence, identities, rows };
    });
    signal?.throwIfAborted();
    const { identities, rows, ...snapshot } = source;
    return { ...snapshot,
      observedKeys: new Set(identities.map(inventoryDescriptionIdentity)), observationReadiness: collectInventoryObservationReadiness(rows) };
  };
  return {
    read: (identity, options) => readSnapshot(identity, options),
    readVerification: (identity, options) => readSnapshot(identity, { ...options, requireCompleteVectors: true }, true),
  };
}
