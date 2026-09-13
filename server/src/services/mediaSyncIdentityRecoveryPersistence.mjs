/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { prepareSyncedMediaItem, persistPreparedSyncItem } from './mediaSyncItemPersistence.mjs';

export async function readSyncIdentityRecoveryReceipt(store, context, item) {
  let receipt = null;
  await store.withCurrentCapture(context, async client => {
    const { rows } = await client.query(`SELECT metadata->'source_identity_recovery' AS receipt
      FROM media_server_items WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3
        AND to_jsonb(tmdb_id)=metadata->'source_identity_recovery'->'tmdb_id'`,
    [context.libraryId, context.mediaServerId, item.external_id]);
    receipt = rows[0]?.receipt ?? null;
  });
  return receipt;
}

/** Durable retry budget, reset by changed evidence; no provider IO under locks. */
export async function claimSyncIdentityRecovery(store, context, item) {
  let claimed = false;
  await store.withCurrentCapture(context, async client => {
    const result = await client.query(`UPDATE media_source_observations
      SET recovery_retry_after=clock_timestamp()+INTERVAL '1 day'
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND generation=$4 AND source_digest=$5
        AND (recovery_retry_after IS NULL OR recovery_retry_after<=clock_timestamp()) RETURNING external_id`,
    [context.libraryId, context.mediaServerId, item.external_id, context.generation, item.source_identity_evidence.snapshotDigest]);
    claimed = result.rowCount === 1;
  });
  return claimed;
}

/** Accept only a proof produced for this sync, never a source-supplied receipt. */
export async function persistRecoveredSyncItem(store, context, recovery, {
  analyze = (...args) => contentTypeAnalyzer.analyze(...args),
} = {}) {
  const { libraryId, mediaServerId, generation } = context;
  const prepared = await prepareSyncedMediaItem(mediaServerId, recovery.item, analyze);
  if (!prepared) return false;
  let persisted = false;
  await store.withCurrentCapture(context, async client => {
    const library = await client.query(`SELECT id FROM libraries
      WHERE id=$1 AND media_server_id=$2 AND is_active=true FOR SHARE`, [libraryId, mediaServerId]);
    if (library.rowCount !== 1) return;
    const { rowCount } = await client.query(`SELECT external_id FROM media_source_observations
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND generation=$4
        AND source_digest=$5 FOR UPDATE`,
    [libraryId, mediaServerId, recovery.item.external_id, generation, recovery.receipt.source_digest]);
    if (rowCount !== 1) return;
    const result = await persistPreparedSyncItem(mediaServerId, libraryId, prepared, client.query.bind(client));
    if (result !== 'synced') throw new Error('Source identity recovery was superseded');
    const updated = await client.query(`UPDATE media_server_items
      SET metadata=jsonb_set(metadata, '{source_identity_recovery}', $4::jsonb)
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND tmdb_id=$5 RETURNING id`,
    [libraryId, mediaServerId, recovery.item.external_id, JSON.stringify(recovery.receipt), recovery.item.tmdb_id]);
    if (updated.rowCount !== 1) throw new Error('Source identity recovery write was unavailable');
    await client.query(`DELETE FROM media_source_observations
      WHERE library_id=$1 AND media_server_id=$2 AND external_id=$3 AND generation=$4`,
    [libraryId, mediaServerId, recovery.item.external_id, generation]);
    persisted = true;
  });
  return persisted;
}
