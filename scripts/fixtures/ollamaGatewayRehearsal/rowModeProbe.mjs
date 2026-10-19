/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import pg from '/app/node_modules/pg/lib/index.js';
import * as original from '/app/src/ollamaGateway/catalogRowReader.mjs';
import { captureCatalogContent as productionContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { readVerifiedGatewayArchive } from '/app/src/ollamaGateway/archiveFiles.mjs';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import * as parsers from '/app/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';
import * as candidate from './rowModeCandidate.mjs';
import { captureCatalogContent } from './rowModeContent.mjs';
import { ROW_ORDER, requireRowParity, rowSha256, requireRowRuns } from './rowModeContract.mjs';
import { validateRestoreIdentity } from './restoreStudyContract.mjs';
import { observeRowRun } from './rowModeObservations.mjs';
import { sampleRestoreAllocations, requireRestoreHeapSummary } from './restoreStudyHeap.mjs';
import { qualificationResources } from './archiveQualificationResources.mjs';
import { createStudyResourceSample } from './studyResource.mjs';

export async function runRowModeProbe(lane, phase = () => {}) {
  assert.ok(['natural','allocations'].includes(lane));
  phase('parity');
  requireRowParity(...await Promise.all(['/app/src/ollamaGateway/catalogRowReader.mjs','/app/src/ollamaGateway/catalogContent.mjs',
    '/fixtures/rowModeCandidate.mjs','/fixtures/rowModeContent.mjs'].map(path => readFile(path,'utf8'))));
  const identity = validateRestoreIdentity(JSON.parse(await readFile('/results/restore-source.json','utf8')));
  phase('identity');
  const checked = await readVerifiedGatewayArchive(`/catalogs/gateway-archive-${identity.archiveId}`,AbortSignal.timeout(120000));
  assert.equal(checked.manifestSha256,identity.manifestSha256); assert.equal(checked.manifest.dump.sha256,identity.dumpSha256);
  const client = new pg.Client({ host:'/source-socket',database:'gateway_inference_soak',user:'soak_reader',
    options:'-c default_transaction_read_only=on',connectionTimeoutMillis:5000,statement_timeout:4000,query_timeout:5000 });
  client.on('error',() => {});
  const controller = new AbortController(), stop = () => { controller.abort(); void client.end().catch(() => {}); };
  const timer = setTimeout(stop,600000); process.once('SIGTERM',stop); process.once('SIGINT',stop);
  try {
    await client.connect();
    phase('snapshot');
    assert.deepEqual((await client.query(`SELECT current_user AS role,current_database() AS database,
      current_setting('transaction_read_only') AS readonly,has_table_privilege(current_user,'ollama_gateway.admission','UPDATE') AS can_write`)).rows[0],
    { role:'soak_reader',database:'gateway_inference_soak',readonly:'on',can_write:false });
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
    assert.deepEqual((await client.query('SELECT attempt,manifest_sha256 FROM gateway_catalog.job WHERE id=$1',[identity.archiveId])).rows,
      [{ attempt:2,manifest_sha256:identity.manifestSha256 }]);
    const baselineBudget = { bytes:0 }, baseline = await productionContent(client,controller.signal,baselineBudget,3);
    assert.equal(Object.values(baseline).reduce((sum,row) => sum+row.count,0),3002);
    const resources = await qualificationResources();
    assert.equal(resources.limits.memory,'1610612736'); assert.equal(resources.limits.swap,'0');
    assert.equal(resources.limits.cpu,'100000 100000'); assert.equal(resources.limits.pids,'64');
    const readSample = createStudyResourceSample({ version:resources.limits.version,read:readResidentText,parsers,
      extra:async () => { const heap = getHeapStatistics(); return { ...process.memoryUsage(),heapPhysical:heap.total_physical_size,v8Malloc:heap.malloced_memory }; } });
    // Unmeasured warm-up uses the same common accumulator as both measured modes.
    phase('warmup');
    const warmBudget = { bytes:0 };
    assert.deepEqual(await captureCatalogContent(client,controller.signal,warmBudget,3,original.visitCatalogRows),baseline);
    assert.equal(warmBudget.bytes,baselineBudget.bytes);
    const runs = [];
    phase('runs');
    for (const mode of ROW_ORDER) {
      controller.signal.throwIfAborted();
      const reader = mode === 'object' ? original : candidate, budget = { bytes:0 };
      let bodyBytes = 0, fetchedRows = 0, queryMs = 0;
      const wrapped = { query:async (...args) => {
        const started = performance.now(), result = await client.query(...args); queryMs += performance.now()-started;
        const text = typeof args[0] === 'string' ? args[0] : args[0].text;
        if (text === 'FETCH FORWARD 16 FROM gateway_catalog_cursor') {
          fetchedRows += result.rows.length;
          for (const row of result.rows) {
            const body = mode === 'object' ? row.row : row[1];
            if (typeof body === 'string') bodyBytes += Buffer.byteLength(body);
          }
        }
        return result;
      } };
      const work = () => captureCatalogContent(wrapped,AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]),budget,3,reader.visitCatalogRows);
      const observed = await observeRowRun(async () => lane === 'allocations' ? await sampleRestoreAllocations(work) : { value:await work() },readSample);
      const { value:tables,profile } = observed.value;
      assert.deepEqual(tables,baseline); assert.equal(budget.bytes,baselineBudget.bytes);
      if (profile) requireRestoreHeapSummary(profile);
      const { value:unused, ...metrics } = observed; void unused;
      const row = { fixture:'row-mode-run',lane,mode,equivalent:true,bodyBytes,fetchedRows,chargedBytes:budget.bytes,
        contentSha256:rowSha256(JSON.stringify(tables)),queryMs,backendCpuTicks:null,...metrics,...(profile ? { profile } : {}) };
      runs.push(row); console.log(JSON.stringify(row));
    }
    requireRowRuns(runs,lane);
    phase('probes');
    let probes = 0;
    for (const reader of [original,candidate]) {
      const closed = async () => assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_cursors WHERE name='gateway_catalog_cursor'")).rows[0].n,0);
      await assert.rejects(reader.visitCatalogRows(client,0,() => {},AbortSignal.abort())); await closed(); probes++;
      await assert.rejects(captureCatalogContent(client,controller.signal,{ bytes:268435456 },3,reader.visitCatalogRows),/gateway_catalog_size_limit/); await closed(); probes++;
      await assert.rejects(reader.visitCatalogRows(client,0,() => { throw new Error('row_mode_consumer'); }),/row_mode_consumer/); await closed(); probes++;
      const cancellation = new AbortController();
      await assert.rejects(reader.visitCatalogRows(client,0,() => cancellation.abort(),cancellation.signal)); await closed(); probes++;
      const selected = [], empty = [];
      await reader.visitCatalogDependencyRows(client,row => selected.push(row),controller.signal,new Set());
      await reader.visitCatalogDependencyRows(client,row => empty.push(row),controller.signal,new Set());
      assert.deepEqual(selected,empty); assert.deepEqual(empty,[]); probes++;
    }
    await client.query('SAVEPOINT row_mode_denial');
    await assert.rejects(client.query('UPDATE ollama_gateway.admission SET attempts=0'),error => ['42501','25006'].includes(error.code));
    await client.query('ROLLBACK TO SAVEPOINT row_mode_denial; RELEASE SAVEPOINT row_mode_denial');
    const originalDependencies = [], candidateDependencies = [];
    await original.visitCatalogDependencyRows(client,row => originalDependencies.push(row),controller.signal);
    await candidate.visitCatalogDependencyRows(client,row => candidateDependencies.push(row),controller.signal);
    assert.deepEqual(candidateDependencies,originalDependencies); assert.equal(candidateDependencies.length,1);
    assert.deepEqual(await productionContent(client,controller.signal,{ bytes:0 },3),baseline);
    await client.query('ROLLBACK'); controller.signal.throwIfAborted();
    phase('completion');
    const final = await resources.metrics();
    assert.ok(Object.values(final.memoryEvents).every(value => value === '0')); assert.equal(final.pidsEvents,'max 0');
    console.log(JSON.stringify({ fixture:'row-mode-complete',lane,equivalent:true,probes,dependencyRows:1,
      warmups:1,baselineReads:1,readOnlyDenial:true,limits:resources.limits,...final }));
  } finally {
    clearTimeout(timer); process.removeListener('SIGTERM',stop); process.removeListener('SIGINT',stop);
    await client.end();
  }
}
