/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { captureRetentionInventory } from '/app/src/ollamaGateway/archiveRetentionQueries.mjs';
import { assertArchiveSnapshot,withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchiveSnapshot.mjs';
import { captureCatalogContent as captureTail } from './snapshotReuseContent.mjs';
import { withSnapshotReuse } from './snapshotReuseCache.mjs';
import { REUSE_ORDER,reuseSha,requireReuseRuns } from './snapshotReuseContract.mjs';
import { reuseConfiguration } from './snapshotReuseData.mjs';

export const reuseOptions = (client,context,signal) => ({client,context,signal,assertSnapshot:assertArchiveSnapshot,
  readRetention:captureRetentionInventory,readBase:captureCatalogContent,readTail:captureTail});

export async function compareSnapshotReads(client,lane,signal) {
  return withOnlineArchiveSnapshot(client,reuseConfiguration,async context => {
    const initial = {bytes:0}, expected = {inventory:await captureRetentionInventory(client,context.report),
      scheduling:await captureCatalogContent(client,signal,initial),catalog:await captureCatalogContent(client,signal,initial,3)};
    assert.equal(expected.inventory.entries.length,100); assert.equal(expected.inventory.hasMore,true);
    assert.equal(expected.catalog['gateway_catalog.job'].count,2);
    const runs = [];
    for (const mode of REUSE_ORDER) {
      let queries = 0, resultStringBytes = 0, queryMs = 0;
      // Guard identity remains the actual client, not a query-wrapper impostor.
      const original = client.query;
      client.query = async function (...args) {
        const at = performance.now(); const result = await original.apply(this,args); queryMs += performance.now()-at; queries++;
        for (const row of result.rows ?? []) for (const value of Object.values(row)) {
          if (typeof value === 'string') resultStringBytes += Buffer.byteLength(value);
        }
        return result;
      };
      const budget = {bytes:0}, cpu = process.cpuUsage(), at = performance.now(); let actual;
      try {
        if (mode === 'baseline') {
          const first = await captureRetentionInventory(client,context.report), inventory = await captureRetentionInventory(client,context.report);
          assert.deepEqual(first,inventory);
          actual = {inventory,scheduling:await captureCatalogContent(client,signal,budget),catalog:await captureCatalogContent(client,signal,budget,3)};
        } else actual = await withSnapshotReuse(reuseOptions(client,context,signal),async cache => {
          const first = await cache.retention(client,context), inventory = await cache.retention(client,context); assert.deepEqual(first,inventory);
          return {inventory,scheduling:await cache.catalog(client,context,budget),catalog:await cache.catalog(client,context,budget,3)};
        });
      } finally { client.query = original; }
      const elapsedMs = performance.now()-at, usage = process.cpuUsage(cpu);
      assert.deepEqual(actual,expected); assert.equal(budget.bytes,initial.bytes);
      const row = {fixture:'snapshot-reuse-run',lane,mode,equivalent:true,sha256:reuseSha(actual),chargedBytes:budget.bytes,
        queries,resultStringBytes,queryMs,elapsedMs,processCpuUs:usage.user+usage.system}; runs.push(row); console.log(JSON.stringify(row));
    }
    requireReuseRuns(runs); return reuseSha(expected.catalog);
  },signal);
}
