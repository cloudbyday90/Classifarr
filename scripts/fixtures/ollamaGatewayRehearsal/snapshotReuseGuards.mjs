/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchiveSnapshot.mjs';
import { captureRetentionInventory } from '/app/src/ollamaGateway/archiveRetentionQueries.mjs';
import { reuseOptions } from './snapshotReuseProbe.mjs';
import { withSnapshotReuse } from './snapshotReuseCache.mjs';
import { reuseConfiguration } from './snapshotReuseData.mjs';

export async function probeSnapshotReuse(reader,owner,signal) {
  let escaped, expired, count = 0;
  const closed = async () => assert.equal((await reader.query("SELECT count(*)::int AS n FROM pg_cursors WHERE name='gateway_catalog_cursor'")).rows[0].n,0);
  await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
    expired = context;
    await withSnapshotReuse(reuseOptions(reader,context,signal),async cache => {
      escaped = cache; await cache.retention(reader,context); await cache.catalog(reader,context,{bytes:0});
      assert.throws(() => { /* Deeply frozen, including entries and table summaries. */
        Object.assign(context,{revision:'fabricated'});
      });
      await assert.rejects(cache.retention(owner,context),/snapshot_reuse_client/); count++;
      await assert.rejects(cache.retention(reader,{...context}),/snapshot_reuse_context/); count++;
      await assert.rejects(cache.catalog(reader,context,{bytes:268435456},3),/gateway_catalog_size_limit/); count++;
      const inventory = await cache.retention(reader,context);
      assert.throws(() => {inventory.entries[0].attempt='1';}); count++;
      await reader.query('SAVEPOINT reuse_denial');
      await assert.rejects(reader.query('UPDATE ollama_gateway.admission SET attempts=0'),error => ['42501','25006'].includes(error.code));
      await reader.query('ROLLBACK TO SAVEPOINT reuse_denial; RELEASE SAVEPOINT reuse_denial'); count++;
    });
  },signal);
  await assert.rejects(escaped.retention(reader,expired),/snapshot_reuse_closed/); count++;
  await assert.rejects(withSnapshotReuse(reuseOptions(reader,expired,signal),async () => {}),/gateway_archive_snapshot_invalid/); count++;
  await assert.rejects(withSnapshotReuse(reuseOptions(reader,{...expired},signal),async () => {}),/gateway_archive_snapshot_invalid/); count++;
  await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
    await assert.rejects(withSnapshotReuse(reuseOptions(reader,expired,signal),async () => {}),/gateway_archive_snapshot_invalid/); count++;
    await withSnapshotReuse(reuseOptions(reader,context,signal),async cache => { assert.equal((await cache.retention(reader,context)).entries.length,100); });
  },signal);
  await assert.rejects(withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
    await withSnapshotReuse(reuseOptions(reader,context,signal),async cache => { escaped = cache; throw Error('reuse_rollback'); });
  },signal),/reuse_rollback/);
  await assert.rejects(escaped.catalog(reader,expired,{bytes:0}),/snapshot_reuse_closed/); count++;
  for (const during of [false,true]) {
    const controller = new AbortController();
    await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
      const original = reader.query;
      try {
        if (during) reader.query = async function (...args) {
          const result = await original.apply(this,args); if (args[0] === 'FETCH FORWARD 16 FROM gateway_catalog_cursor') controller.abort(); return result;
        };
        else controller.abort();
        await assert.rejects(withSnapshotReuse(reuseOptions(reader,context,controller.signal),cache => cache.catalog(reader,context,{bytes:0})));
      } finally { reader.query = original; }
      await closed(); count++;
    },signal);
  }
  // Owner changes SQL after the reader snapshot froze. Both strategies must see
  // old bytes there; the next transaction must see the committed new bytes.
  const job = (await owner.query('SELECT id,manifest FROM gateway_archive.job ORDER BY id LIMIT 1')).rows[0];
  let oldTables;
  try {
    await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
      await withSnapshotReuse(reuseOptions(reader,context,signal),async cache => {
        oldTables = await cache.catalog(reader,context,{bytes:0});
        await owner.query("UPDATE gateway_archive.job SET manifest=jsonb_build_object('concurrent',true) WHERE id=$1",[job.id]);
        assert.deepEqual(await cache.catalog(reader,context,{bytes:0}),oldTables);
        assert.deepEqual(await captureCatalogContent(reader,signal,{bytes:0}),oldTables); count++;
      });
    },signal);
    await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
      await withSnapshotReuse(reuseOptions(reader,context,signal),async cache => {
        const fresh = await cache.catalog(reader,context,{bytes:0}); assert.notDeepEqual(fresh,oldTables);
        assert.deepEqual(fresh,await captureCatalogContent(reader,signal,{bytes:0})); count++;
      });
    },signal);
    await owner.query("UPDATE gateway_archive.job SET manifest=jsonb_build_object('oversized',repeat('x',131072)) WHERE id=$1",[job.id]);
    await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
      await assert.rejects(captureCatalogContent(reader,signal,{bytes:0}),/gateway_catalog_size_limit/); await closed();
      await assert.rejects(withSnapshotReuse(reuseOptions(reader,context,signal),cache => cache.catalog(reader,context,{bytes:0})),/gateway_catalog_size_limit/);
      await closed(); count++;
    },signal);
  } finally { await owner.query('UPDATE gateway_archive.job SET manifest=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(job.manifest)]); }
  await withOnlineArchiveSnapshot(reader,reuseConfiguration,async context => {
    assert.equal((await captureRetentionInventory(reader,context.report)).entries.length,100);
  },signal);
  return count;
}
