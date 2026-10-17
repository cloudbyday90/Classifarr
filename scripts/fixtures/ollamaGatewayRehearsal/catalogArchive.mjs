/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { createOnlineArchive, withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { verifyArchiveRestore } from '/app/src/ollamaGateway/archiveVerifier.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const action = process.argv[2];
const connection = { host: '/var/run/postgresql',user: 'classifarr',database: 'gateway_online_archive_fixture' };
if (action === 'capture') {
  const owner = new pg.Client(connection); let reader, ledger;
  try {
    await owner.connect();
    await owner.query(await readFile('/app/database/ollama-gateway-cleanup/current.sql','utf8'));
    await owner.query(`CREATE ROLE catalog_fixture_reader LOGIN;
      GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_fixture_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_fixture_reader;
      SELECT pg_advisory_lock(11435,4)`);
    await owner.query(`INSERT INTO gateway_cleanup.operation(protection_id,ledger_id,provider_hash,candidates_sha256,
      attempt,status,last_attempt_at,completed_at,completed_xid,confirmed_at,deleted_bindings,deleted_completions,deleted_peers)
      SELECT id,ledger_id,provider_hash,candidates_sha256,3,'completed','2026-10-17 00:00:00.123456+00',
        '2026-10-17 00:01:00.654321+00','9007199254740993'::xid8,'2026-10-17 00:02:00.987654+00',100,100,0
      FROM gateway_archive.protection WHERE ready_at IS NOT NULL;
      INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,created_at,completed_at,retry_after,reason)
      SELECT id,provider_hash,repeat('a',64),repeat('f',64),3,'failed','2026-10-17 00:00:00.123456+00',
        '2026-10-17 00:01:00.654321+00','2026-10-17 00:31:00.987654+00','cancelled' FROM ollama_gateway.admission;
      UPDATE ollama_gateway.admission SET attempts=9007199254740993`);
    ledger = await openGatewayLedger(owner,'e'.repeat(64));
    const configuration = { database: { ...connection,user: 'catalog_fixture_reader' },providerHash: 'e'.repeat(64),retentionDays: 90 };
    const identity = await withOnlineArchiveSnapshot(owner,configuration,async value => value);
    const job = (await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status)
      VALUES($1,$2,$3,$4,1,'exporting') RETURNING *`,[identity.report.ledgerId,configuration.providerHash,archivePolicyHash(90),identity.revision])).rows[0];
    await owner.query('SELECT pg_advisory_unlock(11435,4)');
    reader = new pg.Client(configuration.database); await reader.connect();
    const query = reader.query.bind(reader); let advanced = false;
    reader.query = async (...args) => {
      const result = await query(...args);
      if (args[0] === 'SELECT pg_export_snapshot() AS snapshot') {
        const request = await ledger.claim('synthetic-catalog');
        await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 }); advanced = true;
      }
      return result;
    };
    const captured = await createOnlineArchive(reader,configuration,'/archives',job,[],AbortSignal.timeout(120000),{ receipts: '/receipts' });
    assert.ok(advanced); assert.equal(captured.manifest.version,5);
    assert.equal(captured.manifest.report.attempts,'9007199254740993');
    assert.equal(captured.manifest.report.bindingCount,109);
    assert.equal((await owner.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows[0].attempts,'9007199254740994');
    assert.equal((await owner.query('SELECT status,attempt FROM gateway_archive.job WHERE id=$1',[job.id])).rows[0].status,'exporting');
    await assert.rejects(createOnlineArchive(reader,configuration,'/archives',job,[],AbortSignal.abort(),{ receipts: '/receipts' }));
    assert.equal((await owner.query('SELECT attempt FROM gateway_archive.job WHERE id=$1',[job.id])).rows[0].attempt,1);
    await writeFile('/tmp/catalog-fixture-id',job.id,{ mode: 0o600,flag: 'wx' });
    process.stdout.write('catalog_capture_passed: ten matching tables; concurrent inference; original exporting job; preserved cancellation attempt\n');
  } finally { await reader?.end(); await owner.end(); }
} else if (['verify','missing','tampered'].includes(action)) {
  const names = await readdir('/archives'); let directory;
  for (const name of names) {
    if (!/^gateway-archive-[a-f0-9-]{36}$/.test(name)) continue;
    const path = `/archives/${name}`;
    try { if (JSON.parse(await readFile(`${path}/manifest.json`,'utf8')).version === 5) directory = path; } catch { /* Retired fixture. */ }
  }
  assert.ok(directory);
  const original = pg.Client.prototype.query; let independent = 0;
  pg.Client.prototype.query = async function (...args) {
    if (args[0] === 'COMMIT' && this.connectionParameters.host.startsWith('/verification/gateway-verify-')) {
      const value = (await original.call(this,`SELECT attempts::text,binding_count FROM ollama_gateway.admission`)).rows[0];
      assert.deepEqual(value,{ attempts: '9007199254740993',binding_count: 109 });
      const op = (await original.call(this,`SELECT completed_xid::text,completed_at::text,confirmed_at::text,attempt,status
        FROM gateway_cleanup.operation`)).rows[0];
      assert.deepEqual(op,{ completed_xid: '9007199254740993',completed_at: '2026-10-17 00:01:00.654321+00',
        confirmed_at: '2026-10-17 00:02:00.987654+00',attempt: 3,status: 'completed' });
      const jobs = (await original.call(this,`SELECT status,attempt,reason,retry_after::text FROM gateway_archive.job WHERE reason='cancelled'`)).rows;
      assert.deepEqual(jobs,[{ status: 'failed',attempt: 3,reason: 'cancelled',retry_after: '2026-10-17 00:31:00.987654+00' }]);
      assert.equal((await original.call(this,"SELECT count(*)::int AS n FROM gateway_archive.job WHERE status='exporting' AND receipt IS NULL")).rows[0].n,1);
      independent++;
    }
    return original.apply(this,args);
  };
  try {
    await assert.rejects(verifyArchiveRestore(directory,'/verification',AbortSignal.timeout(120000)),{ code: 'gateway_archive_restore_contract' });
    const result = await verifyArchiveRestore(directory,'/verification',AbortSignal.timeout(120000),{ archives: '/archives',receipts: '/receipts' });
    assert.equal(result.rowsRestored,action !== 'tampered');
    assert.equal(result.dependenciesAvailable,action === 'verify');
    assert.equal(result.runtimeEnabled,false); assert.equal(result.purgeAuthorized,false);
    assert.equal(independent,action === 'verify' ? 1 : 0);
    assert.deepEqual(await readdir('/verification'),[]);
    process.stdout.write(`catalog_${action}_passed: exact SQL; separate dependency result; no runtime authority\n`);
  } finally { pg.Client.prototype.query = original; }
} else if (['hide-marker','restore-marker','tamper','restore-manifest'].includes(action)) {
  const owner = new pg.Client(connection);
  try {
    await owner.connect();
    const id = await readFile('/tmp/catalog-fixture-id','utf8'), manifest = `/archives/gateway-archive-${id}/manifest.json`;
    const markerId = (await owner.query('SELECT first_archive_id FROM gateway_archive.protection WHERE ready_at IS NOT NULL')).rows[0].first_archive_id;
    const marker = `/archives/gateway-archive-${markerId}/protection.json`;
    if (action === 'hide-marker') { await writeFile('/tmp/catalog-marker-original',await readFile(marker),{ mode: 0o600,flag: 'wx' }); await unlink(marker); }
    if (action === 'restore-marker') {
      await assert.rejects(stat(marker),{ code: 'ENOENT' });
      await writeFile(marker,await readFile('/tmp/catalog-marker-original'),{ mode: 0o600,flag: 'wx' });
    }
    if (action === 'tamper') {
      const data = await readFile(manifest); await writeFile('/tmp/catalog-manifest-original',data,{ mode: 0o600,flag: 'wx' });
      const value = JSON.parse(data); value.catalog.tables['gateway_cleanup.operation'].sha256 = '0'.repeat(64);
      await writeFile(manifest,`${JSON.stringify(value)}\n`);
    }
    if (action === 'restore-manifest') await writeFile(manifest,await readFile('/tmp/catalog-manifest-original'));
  } finally { await owner.end(); }
} else throw new Error('catalog_fixture_action_invalid');
