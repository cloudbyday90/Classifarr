/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile,readdir,unlink,link,mkdtemp,mkdir,truncate } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { archiveStorageAvailable } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';

if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('isolated_fixture_required');
const action = process.argv[2], databaseName = 'gateway_online_archive_fixture';
const admin = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'classifarr' });
let database;
async function worker() {
  const child = spawn(process.execPath,['/app/src/scripts/runGatewayArchiveWorker.mjs','--once'],{ env: {
    PATH: '/usr/bin:/bin',CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE: '/tmp/archive-worker-fixture.json' },stdio: ['ignore','pipe','pipe'] });
  let output = '',error = '';
  child.stdout.on('data',data => { output += data; }); child.stderr.on('data',data => { error += data; });
  const timer = setTimeout(() => child.kill('SIGKILL'),120000);
  try {
    const code = await new Promise((resolve,reject) => { child.once('error',reject); child.once('close',resolve); });
    assert.equal(code,0,error); return JSON.parse(output);
  } finally { clearTimeout(timer); }
}
try {
  await admin.connect();
  if (action === 'setup') {
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.query('CREATE ROLE archive_fixture_reader LOGIN; CREATE ROLE archive_fixture_writer LOGIN');
  }
  database = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: databaseName }); await database.connect();
  if (action === 'setup') {
    for (const schema of ['ollama-gateway','ollama-gateway-archive']) await database.query(await readFile(`/app/database/${schema}/current.sql`,'utf8'));
    await database.query(`GRANT USAGE ON SCHEMA ollama_gateway TO archive_fixture_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO archive_fixture_reader;
      GRANT USAGE ON SCHEMA gateway_archive TO archive_fixture_writer;
      GRANT SELECT,INSERT,UPDATE ON gateway_archive.job TO archive_fixture_writer`);
    await writeFile('/tmp/archive-worker-fixture.json',JSON.stringify({ source: { database: {
      host: '/var/run/postgresql',database: databaseName,user: 'archive_fixture_reader' },providerHash: 'e'.repeat(64),retentionDays: 90 },
    maintenance: { host: '/var/run/postgresql',database: databaseName,user: 'archive_fixture_writer' },archives: '/archives',receipts: '/receipts' }),
    { mode: 0o600,flag: 'wx' });
    const ledger = await openGatewayLedger(database,'e'.repeat(64));
    const empty = await worker(); assert.equal(empty.state,'empty'); assert.equal((await readdir('/archives')).length,0);
    const request = await ledger.claim('synthetic'); await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 });
    assert.equal((await worker()).state,'awaiting_verification');
    assert.equal((await ledger.status()).attempts,'1');
  } else if (action === 'checks') {
    for (const user of ['archive_fixture_reader','archive_fixture_writer']) {
      const restricted = new pg.Client({ host: '/var/run/postgresql',database: databaseName,user });
      try {
        await restricted.connect();
        await assert.rejects(restricted.query('UPDATE ollama_gateway.admission SET attempts=0'),{ code: '42501' });
        await assert.rejects(restricted.query('DELETE FROM gateway_archive.job'),{ code: '42501' });
      } finally { await restricted.end(); }
    }
    const job = (await database.query('SELECT * FROM gateway_archive.job')).rows[0];
    const resultFile = `/receipts/${job.id}.json`;
    await writeFile(resultFile,JSON.stringify({ version: 1,archiveId: job.id,manifestSha256: 'f'.repeat(64),
      dumpSha256: job.manifest.dump.sha256,verified: true,preserves: [],purgeAuthorized: false }),{ mode: 0o600,flag: 'wx' });
    assert.equal((await worker()).reason,'gateway_archive_receipt_invalid'); await unlink(resultFile);
    assert.equal((await worker()).state,'awaiting_verification');
    assert.equal((await database.query('SELECT attempt FROM gateway_archive.job')).rows[0].attempt,1);
    const parent = await mkdtemp('/tmp/archive-quota-'), results = await mkdtemp('/tmp/archive-receipts-'), jobs = [];
    for (let i=0;i<3;i++) {
      const id = (await database.query('SELECT uuidv7() AS id')).rows[0].id; jobs.push({ id });
      const directory = `${parent}/gateway-archive-${id}`; await mkdir(directory,{ mode: 0o700 });
      await writeFile(`${directory}/gateway.dump`,'',{ mode: 0o600 }); await truncate(`${directory}/gateway.dump`,256*1024*1024);
    }
    assert.equal(await archiveStorageAvailable(parent,results,jobs),false);
    await writeFile(`${parent}/operator-owned`,'keep',{ mode: 0o600,flag: 'wx' });
    await assert.rejects(archiveStorageAvailable(parent,results,jobs),/gateway_archive_unmanaged_files/);
    assert.equal(await readFile(`${parent}/operator-owned`,'utf8'),'keep');
  } else if (action === 'receipt-crash') {
    const job = (await database.query("SELECT id FROM gateway_archive.job WHERE status='awaiting_verification'")).rows[0];
    await link(`/receipts/${job.id}.json`,`/receipts/${job.id}.pending`);
  } else if (action === 'next') {
    const ledger = await openGatewayLedger(database,'e'.repeat(64));
    const request = await ledger.claim('synthetic'); await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 });
    if ((await ledger.status()).attempts === '3') {
      // Populate every history table and the admission/recovery FK cycle before the third restore.
      await database.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,
        installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
        SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,
          'synthetic','online-archive-fixture',clock_timestamp() FROM ollama_gateway.request_binding WHERE attempt=1`);
      await database.query('UPDATE ollama_gateway.admission SET last_recovery_receipt=(SELECT id FROM ollama_gateway.recovery_receipt)');
      await database.query(`INSERT INTO ollama_gateway.provider_stop_intent(binding_id,owner_id,attempts,network_id,
        configuration_hash,network_hash,operator_ref,evidence_ref,reviewed_at)
        SELECT id,owner_id,attempt,repeat('a',64),repeat('b',64),repeat('c',64),'synthetic','online-archive-fixture',now()
        FROM ollama_gateway.request_binding WHERE attempt=2`);
      await database.query(`INSERT INTO ollama_gateway.provider_stop_observation(intent_id,finished_at,exit_code)
        SELECT id,'2026-10-16T00:00:00.000Z',0 FROM ollama_gateway.provider_stop_intent`);
      await database.query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
        SELECT id,repeat('d',64),repeat('e',64) FROM ollama_gateway.request_binding WHERE attempt=3`);
    }
    // Explicit fixture clock advance, not evidence that a real day elapsed; no inference counter is reset.
    await database.query("UPDATE gateway_archive.job SET completed_at=clock_timestamp()-interval '25 hours' WHERE status='verified'");
    assert.equal((await worker()).state,'awaiting_verification');
  } else if (action === 'accept') {
    assert.equal((await worker()).state,'unchanged');
    const jobs = (await database.query('SELECT *,uuid_extract_version(id) AS uuid_version FROM gateway_archive.job ORDER BY created_at')).rows;
    const kept = jobs.filter(job => job.status === 'verified');
    assert.equal(kept.length,Math.min(2,jobs.length));
    assert.ok(jobs.every(job => job.uuid_version === 7 && job.attempt === 1));
    for (const job of kept) { assert.equal(job.receipt.verified,true); assert.equal(job.receipt.purgeAuthorized,false); }
    assert.equal((await readdir('/archives')).length,kept.length);
    if (jobs.length === 3) {
      assert.equal(jobs[0].status,'retired'); assert.ok(jobs[2].receipt.preserves.includes(jobs[0].id));
      assert.equal((await database.query('SELECT count(*)::int AS n FROM ollama_gateway.request_binding')).rows[0].n,3);
      assert.equal((await database.query('SELECT attempts::text FROM ollama_gateway.admission')).rows[0].attempts,'3');
      assert.ok(Object.values(jobs[2].manifest.content).every(table => table.count > 0));
    }
  } else if (action === 'corrupt') {
    const job = (await database.query("SELECT * FROM gateway_archive.job WHERE status='verified' ORDER BY created_at DESC LIMIT 1")).rows[0];
    const path = `/archives/gateway-archive-${job.id}/gateway.dump`, original = await readFile(path);
    await writeFile('/tmp/online-archive-original.dump',original,{ mode: 0o600,flag: 'wx' });
    await writeFile(path,Buffer.from('PGDMPcorrupted'));
    const ledger = await openGatewayLedger(database,'e'.repeat(64));
    const request = await ledger.claim('synthetic'); await ledger.complete(request);
    await database.query("UPDATE gateway_archive.job SET completed_at=clock_timestamp()-interval '25 hours' WHERE status='verified'");
    const result = await worker(); assert.equal(result.state,'archive_blocked'); assert.equal(result.reason,'gateway_archive_verification_failed');
    assert.equal((await readdir('/archives')).length,2); await writeFile(path,original);
  } else throw new Error('unknown_fixture_action');
  process.stdout.write(`online_archive_${action}_passed\n`);
} finally { await database?.end(); await admin.end(); }
