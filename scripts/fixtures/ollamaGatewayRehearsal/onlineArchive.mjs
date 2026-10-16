/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';

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
  } else if (action === 'next') {
    const ledger = await openGatewayLedger(database,'e'.repeat(64));
    const request = await ledger.claim('synthetic'); await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 });
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
