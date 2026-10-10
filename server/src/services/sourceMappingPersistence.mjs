/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareSyncedMediaItem, persistPreparedSyncItem } from './mediaSyncItemPersistence.mjs';
import { sourceMappingConfiguration } from './sourceMappingContract.mjs';
import { READ_SOURCE_MAPPING } from './sourceMappingRecovery.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';

/** Called only inside the existing owned capture. Inventory and completion commit together. */
export async function persistSourceMapping(store, context, proof, { analyze = (...args) => contentTypeAnalyzer.analyze(...args) } = {}) {
  const prepared = await prepareSyncedMediaItem(context.mediaServerId, proof.item, analyze);
  if (!prepared) return false;
  let persisted = false;
  await store.withCurrentCapture(context, async tx => {
    const parameters = [context.libraryId, context.mediaServerId, proof.item.external_id];
    await tx.query('SELECT id FROM media_server WHERE id=$1 FOR SHARE', [context.mediaServerId]);
    await tx.query('SELECT id FROM libraries WHERE id=$1 FOR SHARE', [context.libraryId]);
    const observation = await tx.query(`SELECT external_id FROM media_source_observations
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND generation=$4 AND source_digest=$5 FOR UPDATE`,
    [...parameters,context.generation,proof.mapping.source_digest]);
    if (!observation.rowCount) return;
    const lock = await tx.query('SELECT id FROM source_catalog_mappings WHERE id=$1 AND revoked_at IS NULL FOR UPDATE', [proof.mapping.id]);
    if (!lock.rowCount) return;
    if (proof.mapping.catalog_config?.id) await tx.query('SELECT id FROM tmdb_config WHERE id=$1 FOR SHARE', [proof.mapping.catalog_config.id]);
    const current = (await tx.query(READ_SOURCE_MAPPING, parameters)).rows[0];
    if (!current || current.id !== proof.mapping.id || current.source_digest !== proof.mapping.source_digest ||
        current.configuration_digest !== sourceMappingConfiguration(current)) return;
    // Do not let the previous scalar origin survive a deliberate scoped replacement.
    await tx.query(`UPDATE media_server_items SET tmdb_id=NULL,imdb_id=NULL,tvdb_id=NULL,
      metadata='{}'::jsonb,original_rating=NULL,
      inventory_tmdb_attempted_at=NULL,inventory_tmdb_fetched_at=NULL
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3
        AND (metadata->'source_catalog_mapping'->>'id' IS DISTINCT FROM $4 OR tmdb_id IS DISTINCT FROM $5::integer)`,
    [...parameters,current.id,prepared.ids.tmdb_id]);
    if (await persistPreparedSyncItem(context.mediaServerId, context.libraryId, prepared, tx.query.bind(tx)) !== 'synced') {
      throw new Error('mapping_inventory_changed');
    }
    await tx.query(`UPDATE media_server_items SET metadata=jsonb_set(metadata,'{source_catalog_mapping}',$4::jsonb)
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3`, [...parameters,JSON.stringify({ version: 1, id: current.id })]);
    await tx.query(`UPDATE source_catalog_mappings SET materialized_at=clock_timestamp(),layout_digest=$2,
      documents=$3::jsonb,catalog_verified_at=$4,last_outcome='materialized',retry_after=NULL WHERE id=$1`,
    [current.id,proof.layoutDigest,JSON.stringify(proof.documents),proof.catalogVerifiedAt]);
    await tx.query(`DELETE FROM media_source_observations WHERE library_id=$1 AND media_server_id=$2
      AND external_id=$3 AND generation=$4 AND source_digest=$5`, [...parameters,context.generation,current.source_digest]);
    persisted = true;
  });
  return persisted;
}
