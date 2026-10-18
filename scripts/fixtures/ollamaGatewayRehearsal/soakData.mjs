/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { gatewayProviderIdentity } from '/app/src/ollamaGateway/contract.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { readArchiveReceipt } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
export const soakConnection = { host: '/var/run/postgresql', user: 'classifarr', database: 'gateway_inference_soak' };
export const soakProvider = gatewayProviderIdentity('http://127.0.0.1:11434');
const action = process.argv[2];
if (action === 'setup') {
  const admin = new pg.Client({ ...soakConnection, database: 'classifarr' }); await admin.connect();
  try {
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM libraries')).rows[0].n, 0);
    await admin.query('CREATE DATABASE gateway_inference_soak');
    await admin.query('CREATE ROLE soak_reader LOGIN; CREATE ROLE soak_writer LOGIN; CREATE ROLE soak_runtime LOGIN');
  } finally { await admin.end(); }
}
const client = new pg.Client(soakConnection); await client.connect();
try {
  if (action === 'setup') {
    for (const schema of ['ollama-gateway', 'ollama-gateway-archive', 'ollama-gateway-cleanup', 'ollama-gateway-catalog']) {
      await client.query(await readFile(`/app/database/${schema}/current.sql`, 'utf8'));
    }
    await client.query(`GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO soak_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO soak_reader;
      GRANT SELECT ON gateway_catalog.job TO soak_reader;
      GRANT USAGE ON SCHEMA gateway_archive,gateway_cleanup,gateway_catalog TO soak_writer;
      GRANT SELECT,INSERT,UPDATE ON gateway_archive.job,gateway_catalog.job,gateway_catalog.snapshot TO soak_writer;
      GRANT SELECT,INSERT ON gateway_archive.protection,gateway_catalog.dependency TO soak_writer;
      GRANT UPDATE(ready_at) ON gateway_archive.protection TO soak_writer;
      GRANT SELECT ON gateway_cleanup.operation TO soak_writer;
      GRANT EXECUTE ON FUNCTION gateway_catalog.require_lock() TO soak_writer;
      GRANT USAGE ON SCHEMA ollama_gateway TO soak_runtime;
      GRANT SELECT ON ollama_gateway.admission TO soak_runtime;
      GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
        ON ollama_gateway.admission TO soak_runtime;
      GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt TO soak_runtime;
      GRANT SELECT(binding_id) ON ollama_gateway.provider_stop_intent TO soak_runtime;
      GRANT SELECT(request_id,action,provider_hash,installation,recorded_at) ON ollama_gateway.recovery_receipt TO soak_runtime`);
    await writeFile('/configuration/worker.json', JSON.stringify({ source: { database: { ...soakConnection, host: '/source-socket', user: 'soak_reader' },
      providerHash: soakProvider.providerHash, retentionDays: 90 }, maintenance: { ...soakConnection, host: '/source-socket', user: 'soak_writer' },
    archives: '/archives', receipts: '/receipts', catalogs: '/catalogs' }), { mode: 0o600, flag: 'wx' });
    const ledger = await openGatewayLedger(client, soakProvider.providerHash);
    const id = await ledger.claim('prerequisite'); await ledger.complete(id, false, { state: 'response_completed', httpStatus: 200 });
    await client.query('SELECT pg_advisory_lock(11435,4)');
    await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,reason,completed_at)
      SELECT id,provider_hash,$1,encode(sha256(convert_to(i::text,'UTF8')),'hex'),1,'failed','export_failed',clock_timestamp()
      FROM ollama_gateway.admission CROSS JOIN generate_series(1,3000) i`, [archivePolicyHash(90)]);
  } else if (action === 'wide') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    const repository = archiveJobRepository(client), job = (await repository.list()).find(row => row.status === 'awaiting_verification');
    const receipt = await readArchiveReceipt('/receipts', job.id); assert.equal(receipt.verified, true);
    await repository.verified(job.id, receipt);
    const manifest = (await client.query('SELECT manifest FROM gateway_archive.job WHERE id=$1', [job.id])).rows[0].manifest;
    await client.query(`UPDATE gateway_archive.job SET manifest=$1::jsonb||jsonb_build_object('archiveId',id,'revision',revision,
      'fixturePadding',repeat('x',75000)),manifest_sha256=repeat('f',64) WHERE status='failed'`, [manifest]);
    const bytes = (await client.query('SELECT sum(octet_length(to_jsonb(j)::text)+1)::float8 AS bytes FROM gateway_archive.job j')).rows[0].bytes;
    assert.ok(bytes > 220000000 && bytes < 268435456); console.log(JSON.stringify({ historicalRows: 3000, bytes }));
  } else if (action === 'check') {
    const admission = (await client.query('SELECT attempts::int,binding_count,active_request FROM ollama_gateway.admission')).rows[0];
    assert.deepEqual(admission, { attempts: 481, binding_count: 481, active_request: null });
    const rows = (await client.query(`SELECT count(*)::int AS n,count(DISTINCT work_fingerprint)::int AS fingerprints,
      count(*) FILTER (WHERE uuid_extract_version(id)=7 AND uuid_extract_version(request_id)=7)::int AS v7
      FROM ollama_gateway.request_binding WHERE installation<>'prerequisite'`)).rows[0];
    assert.deepEqual(rows, { n: 480, fingerprints: 480, v7: 480 });
    assert.equal((await client.query('SELECT count(*)::int AS n FROM ollama_gateway.completion_receipt')).rows[0].n, 481);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM gateway_archive.job WHERE status='failed'")).rows[0].n, 3000);
    const jobs = (await client.query('SELECT status,attempt,reason FROM gateway_catalog.job ORDER BY id')).rows;
    assert.ok(jobs.some(row => row.status === 'verified'));
    assert.ok(jobs.every(row => row.status === 'verified' && row.attempt >= 1 && row.attempt <= 3));
    assert.equal((await client.query('SELECT count(*)::int AS n FROM gateway_cleanup.operation')).rows[0].n, 0);
    const windows = JSON.parse(process.argv[3]); assert.ok(Array.isArray(windows) && windows.length <= 20);
    const overlaps = [];
    for (const window of windows) {
      assert.ok(['archiver', 'catalog-verifier'].includes(window.kind));
      assert.ok(Number.isSafeInteger(window.start) && Number.isSafeInteger(window.end) && window.end >= window.start);
      const count = (await client.query(`SELECT count(*)::int AS n FROM ollama_gateway.request_binding
        WHERE installation<>'prerequisite' AND admitted_at BETWEEN to_timestamp($1::double precision/1000) AND to_timestamp($2::double precision/1000)`,
      [window.start, window.end])).rows[0].n;
      overlaps.push({ ...window, admittedRequests: count });
    }
    for (const kind of ['archiver', 'catalog-verifier']) assert.ok(overlaps.some(window => window.kind === kind && window.admittedRequests > 0));
    console.log(JSON.stringify({ admission, rows, catalogJobs: jobs, cleanupOperations: 0, overlaps }));
  } else throw new Error('soak_data_action_invalid');
} finally { await client.end(); }
