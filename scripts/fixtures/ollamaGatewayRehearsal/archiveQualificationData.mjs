/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat, mkdir, truncate } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { archiveStorageAvailable } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { captureArchiveContent } from '/app/src/ollamaGateway/archiveContent.mjs';
import { ARCHIVE_TABLES } from '/app/src/ollamaGateway/archiveContract.mjs';
import { withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { captureRetentionInventory } from '/app/src/ollamaGateway/archiveRetentionQueries.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [action, shape = 'capacity'] = process.argv.slice(2);
assert.ok(['capacity', 'oversize', 'cancel','protection'].includes(shape));
const database = 'gateway_archive_qualification';
const admin = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr' });
let client;
async function seed(count, wide = false) {
  await client.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,
    installation,admitted_at,attempt,evidence_kind,work_version,operation,model,work_fingerprint,fingerprint_key_id)
    SELECT a.id,uuidv7(),a.owner_id,a.provider_hash,repeat('x',64),clock_timestamp()-interval '100 days',i,'unbound',
      1,'/api/generate',repeat('m',$2),repeat('f',64),repeat('a',64)
    FROM ollama_gateway.admission a CROSS JOIN generate_series(a.binding_count+1,$1::int) i`, [count, wide ? 200 : 16]);
  await client.query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT b.request_id,'response_completed',200,b.admitted_at FROM ollama_gateway.request_binding b
    WHERE NOT EXISTS(SELECT 1 FROM ollama_gateway.completion_receipt c WHERE c.request_id=b.request_id)`);
  await client.query('UPDATE ollama_gateway.admission SET attempts=$1::int,binding_count=$1::int,completed_at=clock_timestamp()', [count]);
  await client.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,
    installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
    SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,
      'fixture','capacity',clock_timestamp() FROM ollama_gateway.request_binding b
    WHERE (attempt=1 OR $1) AND NOT EXISTS(SELECT 1 FROM ollama_gateway.recovery_receipt r WHERE r.request_id=b.request_id)`, [wide]);
  await client.query('UPDATE ollama_gateway.admission SET last_recovery_receipt=(SELECT id FROM ollama_gateway.recovery_receipt ORDER BY id LIMIT 1)');
  await client.query(`INSERT INTO ollama_gateway.provider_stop_intent(binding_id,owner_id,attempts,network_id,
    configuration_hash,network_hash,operator_ref,evidence_ref,reviewed_at)
    SELECT id,owner_id,attempt,repeat('a',64),repeat('b',64),repeat('c',64),'fixture','capacity',clock_timestamp()
    FROM ollama_gateway.request_binding b WHERE (attempt=1 OR $1)
    AND NOT EXISTS(SELECT 1 FROM ollama_gateway.provider_stop_intent s WHERE s.binding_id=b.id)`, [wide]);
  await client.query(`INSERT INTO ollama_gateway.provider_stop_observation(intent_id,finished_at,exit_code)
    SELECT id,'2026-10-16T00:00:00.000Z',0 FROM ollama_gateway.provider_stop_intent s
    WHERE NOT EXISTS(SELECT 1 FROM ollama_gateway.provider_stop_observation o WHERE o.intent_id=s.id)`);
  await client.query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
    SELECT id,repeat('d',64),repeat('e',64) FROM ollama_gateway.request_binding b
    WHERE (attempt=1 OR $1) AND NOT EXISTS(SELECT 1 FROM ollama_gateway.upstream_peer_observation p WHERE p.binding_id=b.id)`, [wide]);
}
try {
  await admin.connect();
  if (action === 'setup') {
    await admin.query(`CREATE DATABASE ${database}`);
    await admin.query('CREATE ROLE qualification_reader LOGIN; CREATE ROLE qualification_writer LOGIN');
  }
  client = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database, statement_timeout: 60000 });
  await client.connect();
  let result = {};
  if (action === 'setup') {
    for (const schema of ['ollama-gateway', 'ollama-gateway-archive']) await client.query(await readFile(`/app/database/${schema}/current.sql`, 'utf8'));
    await client.query(`GRANT USAGE ON SCHEMA ollama_gateway TO qualification_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO qualification_reader;
      GRANT USAGE ON SCHEMA gateway_archive TO qualification_writer;
      GRANT SELECT,INSERT,UPDATE ON gateway_archive.job TO qualification_writer;
      GRANT SELECT,INSERT ON gateway_archive.protection TO qualification_writer;
      GRANT UPDATE(ready_at) ON gateway_archive.protection TO qualification_writer;
      UPDATE ollama_gateway.admission SET provider_hash=repeat('e',64),owner_id=uuidv7()`);
    await writeFile('/configuration/worker.json', JSON.stringify({ source: { database: {
      host: '/source-socket', database, user: 'qualification_reader' }, providerHash: 'e'.repeat(64), retentionDays: 90 },
    maintenance: { host: '/source-socket', database, user: 'qualification_writer' }, archives: '/archives', receipts: '/receipts' }),
    { mode: 0o600, flag: 'wx' });
    await seed(shape === 'oversize' ? 1 : 99998);
  } else if (action === 'wide') {
    assert.equal(shape, 'oversize'); await seed(100000, true);
    await client.query("UPDATE gateway_archive.job SET completed_at=clock_timestamp()-interval '25 hours' WHERE status='verified'");
  } else if (action === 'admit') {
    const ledger = await openGatewayLedger(client, 'e'.repeat(64));
    const request = await ledger.claim('synthetic'); assert.ok(request);
    await ledger.complete(request, false, { state: 'response_completed', httpStatus: 200 });
    result = await ledger.status();
  } else if (action === 'full') {
    const ledger = await openGatewayLedger(client, 'e'.repeat(64));
    const before = await ledger.status(); assert.equal(before.bindingCount, 100000);
    await assert.rejects(ledger.claim('synthetic'), /gateway_admission_deferred/);
    result = before;
  } else if (action === 'due') {
    // Fixture clock advancement only; no inference counters or attempt budgets reset.
    await client.query("UPDATE gateway_archive.job SET completed_at=clock_timestamp()-interval '25 hours' WHERE status='verified' AND recovery_protection_id IS NULL");
  } else if (action === 'changed') {
    await client.query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
      SELECT id,repeat('a',64),repeat('b',64) FROM ollama_gateway.request_binding WHERE attempt=2`);
  } else if (action === 'accept-old') {
    const jobs = (await client.query('SELECT * FROM gateway_archive.job ORDER BY created_at,id')).rows;
    assert.equal(jobs.length, 2); assert.equal(jobs[0].status, 'verified'); assert.equal(jobs[1].status, 'awaiting_verification');
    const latest = jobs[1], receipt = JSON.parse(await readFile(`/receipts/${latest.id}.json`, 'utf8'));
    assert.equal(receipt.verified, true); assert.ok(receipt.preserves.includes(jobs[0].id));
    assert.equal(receipt.manifestSha256, latest.manifest_sha256);
    // Advance scheduling only before immutable protection. This does not prove a day elapsed.
    await client.query("UPDATE gateway_archive.job SET status='verified',receipt=$2,completed_at=clock_timestamp()-interval '25 hours' WHERE id=$1", [latest.id, receipt]);
  } else if (action === 'inspect') {
    const admission = (await client.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows[0];
    const jobs = (await client.query(`SELECT id,status,attempt,reason,retry_after,completed_at,manifest_sha256,recovery_protection_id,revision,
      manifest->'dump'->'bytes' AS bytes,manifest->'content' AS content,receipt,uuid_extract_version(id) AS version
      FROM gateway_archive.job ORDER BY created_at,id`)).rows;
    const counts = (await client.query(`SELECT (SELECT count(*)::int FROM ollama_gateway.request_binding) AS bindings,
      (SELECT count(*)::int FROM ollama_gateway.completion_receipt) AS completions,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND application_name='pg_dump') AS dumps`)).rows[0];
    const protections = (await client.query('SELECT * FROM gateway_archive.protection ORDER BY created_at,id')).rows;
    result = { admission, jobs, counts,protections,archives: await readdir('/archives'), receipts: await readdir('/receipts') };
  } else if (action === 'diagnose') {
    let stage = 'snapshot'; const started = Date.now();
    try {
      await withOnlineArchiveSnapshot(client, { providerHash: 'e'.repeat(64), retentionDays: 90 }, async ({ report }) => {
        stage = 'content'; await captureArchiveContent(client);
        stage = 'inventory'; await captureRetentionInventory(client,report);
      });
      result = { stage, readOnlyCheck: 'passed', elapsedMs: Date.now()-started };
    } catch (error) {
      const allowed = ['57014', 'gateway_archive_size_limit', 'gateway_archive_source_inconsistent'];
      result = { stage, readOnlyCheck: 'failed', code: allowed.includes(error.code) ? error.code : 'unclassified', elapsedMs: Date.now()-started };
    }
    result.files = [];
    for (const name of await readdir('/archives')) {
      if (!/^gateway-archive-[a-f0-9-]{36}$/.test(name)) continue;
      for (const file of await readdir(`/archives/${name}`)) {
        if (!['manifest.json','gateway.dump'].includes(file)) continue;
        result.files.push({ name: file, bytes: (await stat(`/archives/${name}/${file}`)).size });
      }
    }
  } else if (action === 'fingerprint') {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    result = await captureArchiveContent(client); await client.query('COMMIT');
  } else if (action === 'size') {
    const tables = {};
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    for (const name of ARCHIVE_TABLES) {
      // The same fixed packaged table allowlist as the runtime content scanner.
      tables[name] = Number((await client.query(`SELECT coalesce(sum(octet_length(to_jsonb(t)::text)+1),0)::text AS bytes
        FROM ollama_gateway.${name} t`)).rows[0].bytes);
    }
    result = { canonicalBytes: Object.values(tables).reduce((sum, value) => sum + value, 0), tables };
    if (shape === 'oversize') {
      assert.ok(result.canonicalBytes > 268435456);
      await assert.rejects(captureArchiveContent(client), { code: 'gateway_archive_size_limit' });
    }
    await client.query('COMMIT');
  } else if (action === 'quota') {
    const parent = '/archives/quota-check', receipts = '/receipts/quota-check';
    await mkdir(parent, { mode: 0o700 }); await mkdir(receipts, { mode: 0o700 });
    const ids = (await client.query('SELECT uuidv7() AS id FROM generate_series(1,3)')).rows;
    const capacity = 1073741824 - 268435456 - 131072;
    for (const [index, job] of ids.entries()) {
      const directory = `${parent}/gateway-archive-${job.id}`; await mkdir(directory, { mode: 0o700 });
      const file = `${directory}/gateway.dump`; await writeFile(file, '', { mode: 0o600, flag: 'wx' });
      await truncate(file, index < 2 ? 268435456 : capacity - 536870912);
    }
    assert.equal(await archiveStorageAvailable(parent, receipts, ids), true);
    const last = `${parent}/gateway-archive-${ids[2].id}/gateway.dump`;
    await truncate(last, (await stat(last)).size + 1);
    assert.equal(await archiveStorageAvailable(parent, receipts, ids), false);
    // The separate 16 MiB mount cannot satisfy the real 320 MiB reservation.
    await mkdir('/quota/archives', { mode: 0o700 }); await mkdir('/quota/receipts', { mode: 0o700 });
    assert.equal(await archiveStorageAvailable('/quota/archives', '/quota/receipts', []), false);
    result = { logicalBoundary: capacity, oneByteOverRefused: true, actualFreeSpaceRefused: true };
  } else throw new Error('qualification_action_invalid');
  process.stdout.write(`${JSON.stringify({ fixture: action, ...result })}\n`);
} finally { await client?.end(); await admin.end(); }
