/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { captureArchiveContent } from '/app/src/ollamaGateway/archiveContent.mjs';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { validateRestoreIdentity } from './restoreStudyContract.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const action = process.argv[2]; assert.ok(['before','after'].includes(action));
const client = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'gateway_inference_soak',
  statement_timeout: 4000, query_timeout: 5000 });
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
  const signal = AbortSignal.timeout(120000), budget = { bytes: 0, rowLimit: 131072 };
  const archive = await captureArchiveContent(client, signal, null, budget), catalog = await captureCatalogContent(client, signal, budget, 3);
  const admission = (await client.query('SELECT attempts::text,binding_count,active_request FROM ollama_gateway.admission')).rows;
  assert.deepEqual(admission, [{ attempts: '1', binding_count: 1, active_request: null }]);
  const counts = (await client.query(`SELECT (SELECT count(*)::int FROM gateway_catalog.snapshot) AS snapshots,
    (SELECT count(*)::int FROM gateway_catalog.dependency) AS dependencies,
    (SELECT count(*)::int FROM gateway_archive.job WHERE status='failed') AS failed`)).rows[0];
  assert.deepEqual(counts, { snapshots: 0, dependencies: 0, failed: 3000 });
  assert.equal(catalog['gateway_catalog.job'].count, 1); assert.equal(catalog['gateway_cleanup.operation'].count, 0);
  const jobs = (await client.query(`SELECT id,attempt,compatible_revisions,manifest_sha256,manifest->'dump' AS dump FROM gateway_catalog.job
    WHERE status='awaiting_verification'`)).rows; assert.equal(jobs.length, 1);
  assert.equal(jobs[0].attempt, 2);
  const prerequisite = (await client.query(`SELECT count(*)::int AS n FROM gateway_archive.job
    WHERE status='verified' AND attempt=1 AND revision=ANY($1::text[])`, [jobs[0].compatible_revisions])).rows[0];
  assert.equal(prerequisite.n, 1);
  const identity = validateRestoreIdentity({ archiveId: jobs[0].id, manifestSha256: jobs[0].manifest_sha256,
    dumpSha256: jobs[0].dump.sha256, dumpBytes: jobs[0].dump.bytes, catalogAttempt: jobs[0].attempt,
    sourceSha256: createHash('sha256').update(JSON.stringify({ archive, catalog, counts, admission })).digest('hex') });
  await client.query('ROLLBACK');
  if (action === 'before') await writeFile('/results/restore-source.json', JSON.stringify(identity), { mode: 0o600, flag: 'wx' });
  else assert.deepEqual(identity, JSON.parse(await readFile('/results/restore-source.json', 'utf8')));
  console.log(JSON.stringify({ fixture: 'restore-source', action, ...identity, failedHistoryRows: 3000, sourceUnchanged: action === 'after' }));
} catch {
  console.log(JSON.stringify({ fixture: 'restore-source-failed', action })); process.exitCode = 1;
} finally { await client.end(); }
