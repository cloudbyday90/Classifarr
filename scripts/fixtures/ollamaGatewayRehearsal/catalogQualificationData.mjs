/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat, mkdir, truncate } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { archiveStorageAvailable, readArchiveReceipt } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { captureArchiveContent } from '/app/src/ollamaGateway/archiveContent.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [action, shape] = process.argv.slice(2), database = 'gateway_catalog_qualification';
const connection = { host: '/var/run/postgresql', user: 'classifarr', database };
const providerHash = 'd'.repeat(64), policyHash = archivePolicyHash(90);
let client;
try {
  if (action === 'setup') {
    const admin = new pg.Client({ ...connection, database: 'classifarr' }); await admin.connect();
    try { await admin.query(`CREATE DATABASE ${database}`); await admin.query('CREATE ROLE catalog_reader LOGIN; CREATE ROLE catalog_writer LOGIN'); }
    finally { await admin.end(); }
  }
  client = new pg.Client({ ...connection, statement_timeout: 60000 }); await client.connect();
  let result = {};
  if (action === 'setup') {
    for (const name of ['ollama-gateway','ollama-gateway-archive','ollama-gateway-cleanup','ollama-gateway-catalog']) {
      await client.query(await readFile(`/app/database/${name}/current.sql`, 'utf8'));
    }
    await client.query(`GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO catalog_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_reader;
      GRANT SELECT ON gateway_catalog.job TO catalog_reader;
      GRANT USAGE ON SCHEMA gateway_archive,gateway_cleanup,gateway_catalog TO catalog_writer;
      GRANT SELECT,INSERT,UPDATE ON gateway_archive.job,gateway_catalog.job,gateway_catalog.snapshot TO catalog_writer;
      GRANT SELECT,INSERT ON gateway_archive.protection,gateway_catalog.dependency TO catalog_writer;
      GRANT UPDATE(ready_at) ON gateway_archive.protection TO catalog_writer;
      GRANT SELECT ON gateway_cleanup.operation TO catalog_writer;
      GRANT EXECUTE ON FUNCTION gateway_catalog.require_lock() TO catalog_writer`);
    await writeFile('/configuration/worker.json', JSON.stringify({ source: { database: { ...connection, host: '/source-socket', user: 'catalog_reader' },
      providerHash, retentionDays: 90 }, maintenance: { ...connection, host: '/source-socket', user: 'catalog_writer' },
    archives: '/archives', receipts: '/receipts', catalogs: '/catalogs' }), { mode: 0o600, flag: 'wx' });
    await openGatewayLedger(client, providerHash);
  } else if (action === 'admit') {
    const ledger = await openGatewayLedger(client, providerHash), request = await ledger.claim('synthetic');
    assert.ok(request); await ledger.complete(request, false, { state: 'response_completed', httpStatus: 200 });
    result = await ledger.status();
  } else if (action === 'history') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    // Historical failed attempts are inert, not restore evidence or invented successful work.
    const count = shape === 'catalog-wide' ? 3000 : 9999;
    await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,reason,completed_at)
      SELECT id,provider_hash,$1,encode(sha256(convert_to(i::text,'UTF8')),'hex'),1,'failed','export_failed',clock_timestamp()
      FROM ollama_gateway.admission CROSS JOIN generate_series(1,$2::int) i`, [policyHash,count]);
    result = { historicalJobs: count };
  } else if (action === 'wide') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    // Preserve nested JSON in historical failed captures, with no usable receipt/files.
    const manifest = (await client.query("SELECT manifest FROM gateway_archive.job WHERE status='verified' ORDER BY id LIMIT 1")).rows[0].manifest;
    await client.query(`UPDATE gateway_archive.job SET manifest=$1::jsonb||jsonb_build_object('archiveId',id,'revision',revision,
      'fixturePadding',repeat('x',75000)),manifest_sha256=repeat('f',64) WHERE status='failed'`, [manifest]);
    result = (await client.query(`SELECT count(*)::int AS rows,sum(octet_length(to_jsonb(j)::text)+1)::float8 AS bytes,
      max(octet_length(to_jsonb(j)::text)) AS largest FROM gateway_archive.job j`)).rows[0];
    assert.ok(result.bytes > 220000000 && result.bytes < 268435456); assert.ok(result.largest < 131072);
  } else if (action === 'acknowledge-inference') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    const job=(await client.query("SELECT id FROM gateway_archive.job WHERE status='awaiting_verification'")).rows[0];
    const receipt=await readArchiveReceipt('/receipts',job.id); assert.equal(receipt.verified,true);
    await archiveJobRepository(client).verified(job.id,receipt);
  } else if (action === 'history-change') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,reason,completed_at)
      SELECT id,provider_hash,$1,repeat('9',64),1,'failed','cancelled',clock_timestamp() FROM ollama_gateway.admission`,[policyHash]);
  } else if (action === 'inspect' || action === 'diagnose') {
    result.admission = (await client.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows[0];
    result.jobs = (await client.query(`SELECT id,status,attempt,reason,manifest_sha256,manifest->'content' AS content,
      manifest->'catalog'->'tables' AS tables FROM gateway_catalog.job ORDER BY created_at,id`)).rows;
    result.roots = (await client.query('SELECT id,archive_id,status,dependency_count FROM gateway_catalog.snapshot ORDER BY created_at,id')).rows;
    result.dependencies = (await client.query('SELECT count(*)::int AS count FROM gateway_catalog.dependency')).rows[0].count;
    result.receipts = (await readdir('/receipts')).sort();
    result.inferenceJobs = (await client.query('SELECT count(*)::int AS count FROM gateway_archive.job')).rows[0].count;
    result.files = [];
    for (const name of await readdir('/catalogs')) {
      assert.match(name, /^gateway-archive-[a-f0-9-]{36}$/);
      for (const file of await readdir(`/catalogs/${name}`)) result.files.push({ id: name.slice(16), file, bytes: (await stat(`/catalogs/${name}/${file}`)).size });
    }
  } else if (action === 'oversized-evidence') {
    await client.query('SELECT pg_advisory_lock(11435,4)');
    // Deliberately inconsistent SQL-only evidence: must refuse before materializing
    // hundreds of MiB, never mistake it for valid files or completed real work.
    await client.query("UPDATE gateway_archive.job SET status='verified',receipt='{}' WHERE status='failed' AND manifest IS NOT NULL");
    result = { injectedFault: 'oversized_untrusted_evidence', rows: 3000 };
  } else if (action === 'fingerprint') {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    result = await captureArchiveContent(client); await client.query('COMMIT');
  } else if (action === 'quota') {
    // Separate exact fixture directories; sparse bytes test accounting, not physical disk exhaustion.
    for (const path of ['/archives/quota','/catalogs/quota','/receipts/quota']) await mkdir(path, { mode: 0o700 });
    const jobs = (await client.query('SELECT uuidv7() AS id FROM generate_series(1,3)')).rows;
    const limit = 1073741824 - 268435456 - 131072;
    for (const [index,job] of jobs.entries()) {
      const dir = `${index ? '/catalogs' : '/archives'}/quota/gateway-archive-${job.id}`;
      await mkdir(dir, { mode: 0o700 }); await writeFile(`${dir}/gateway.dump`, '', { mode: 0o600,flag: 'wx' });
      await truncate(`${dir}/gateway.dump`, index < 2 ? 268435456 : limit-536870912);
    }
    assert.equal(await archiveStorageAvailable('/catalogs/quota','/receipts/quota',jobs,['/archives/quota']), true);
    await writeFile(`/receipts/quota/${jobs[0].id}.json`, 'x', { mode: 0o600,flag: 'wx' });
    assert.equal(await archiveStorageAvailable('/catalogs/quota','/receipts/quota',jobs,['/archives/quota']), false);
    result = { combinedBudget: true, receiptByteRefused: true };
  } else throw new Error('catalog_qualification_action_invalid');
  process.stdout.write(`${JSON.stringify({ fixture: action, ...result })}\n`);
} finally { await client?.end(); }
