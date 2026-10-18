/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import { inspectCatalogDependencies } from '/app/src/ollamaGateway/catalogDependencies.mjs';
import { requiredCatalogArchives } from '/app/src/ollamaGateway/catalogRecoveryFiles.mjs';

// Previous full-body SQL, adapted only after transfer to the new reader's metadata
// shape. This reference is a fixture; it never replaces an application module.
const fullSelect = 'SELECT id,CASE WHEN octet_length(to_jsonb(t)::text)<=$1 THEN to_jsonb(t)::text END AS row FROM gateway_archive.job t ORDER BY id';
async function cpu(pid) {
  try {
    const text = await readResidentText(`/proc/${pid}/stat`), fields = text.slice(text.lastIndexOf(')')+2).trim().split(/\s+/);
    const ticks = Number(fields[11])+Number(fields[12]);
    assert.ok(Number.isSafeInteger(ticks) && ticks >= 0);
    return { start:fields[19],ticks };
  } catch { return null; }
}

/** Compare on the same real snapshot/files; report aggregate values only. */
export async function compareCatalogReads(client) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
  try {
    const selected = await requiredCatalogArchives(client);
    const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    assert.ok(Number.isSafeInteger(pid) && pid > 0);
    const runs = []; let expected;
    for (const legacy of [true,false,false,true]) {
      let bodyBytes = 0, fetchedRows = 0, queryMs = 0, declaration, values;
      const wrapped = { query:async (...args) => {
        if (args[0].startsWith('DECLARE gateway_catalog_cursor') && args[0].includes(' AS required')) {
          declaration = legacy ? fullSelect : args[0].replace(/^DECLARE gateway_catalog_cursor NO SCROLL CURSOR FOR\s*/,'');
          values = legacy ? args[1].slice(0,1) : args[1];
          args = [`DECLARE gateway_catalog_cursor NO SCROLL CURSOR FOR ${declaration}`,values];
        }
        const started = performance.now(), result = await client.query(...args);
        queryMs += performance.now()-started;
        if (args[0] === 'FETCH FORWARD 16 FROM gateway_catalog_cursor') {
          fetchedRows += result.rows.length;
          for (const row of result.rows) bodyBytes += typeof row.row === 'string' ? Buffer.byteLength(row.row) : 0;
          if (legacy) result.rows = result.rows.map(row => {
            const job = typeof row.row === 'string' ? JSON.parse(row.row) : null;
            const required = Boolean(job?.status === 'verified' && selected.has(job.id));
            return { id:row.id,bytes:job ? Buffer.byteLength(row.row) : 131073,required,row:required ? row.row : null };
          });
        }
        return result;
      } };
      const before = await cpu(pid), started = performance.now(), entries = [];
      const summary = await inspectCatalogDependencies(wrapped,'/archives','/receipts',AbortSignal.timeout(120000),entry => entries.push(entry),selected);
      const elapsedMs = performance.now()-started, after = await cpu(pid);
      const actual = { summary,entries };
      if (expected) assert.deepEqual(actual,expected); else expected = actual;
      const plan = (await client.query(`EXPLAIN (ANALYZE,BUFFERS,SERIALIZE TEXT,TIMING OFF,FORMAT JSON) ${declaration}`,values)).rows[0]['QUERY PLAN'][0];
      runs.push({ mode:legacy ? 'full_reference' : 'selective',bodyBytes,fetchedRows,queryMs,elapsedMs,
        backendCpuTicks:before && after?.start === before.start ? after.ticks-before.ticks : null,
        plan:{ executionMs:plan['Execution Time'],planningMs:plan['Planning Time'],rows:plan.Plan['Actual Rows'],
          sharedHitBlocks:plan.Plan['Shared Hit Blocks'],sharedReadBlocks:plan.Plan['Shared Read Blocks'],
          tempReadBlocks:plan.Plan['Temp Read Blocks'],tempWrittenBlocks:plan.Plan['Temp Written Blocks'] } });
    }
    assert.ok(runs[1].bodyBytes < runs[0].bodyBytes/100,'dependency_transfer_not_reduced');
    await client.query('COMMIT');
    return { runs,dependencyCount:expected.summary.count,dependencySha256:expected.summary.sha256,equivalent:true };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
