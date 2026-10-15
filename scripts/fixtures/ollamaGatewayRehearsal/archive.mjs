/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, chmod, stat, symlink, link, unlink, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import pg from '/app/node_modules/pg/lib/index.js';
import { ARCHIVE_TABLES, ARCHIVE_LIMIT } from '/app/src/ollamaGateway/archiveContract.mjs';
import { createArchiveDirectory, openArchiveFile, verifyGatewayArchive } from '/app/src/ollamaGateway/archiveFiles.mjs';
import { dumpGatewayArchive } from '/app/src/ollamaGateway/archiveDump.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';

async function command(executable, args, env) {
  const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
  child.stdout.on('data', data => { stdout += data; if (stdout.length > 1048576) child.kill('SIGKILL'); });
  child.stderr.on('data', data => { stderr += data; if (stderr.length > 1048576) child.kill('SIGKILL'); });
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    return { code, stdout, stderr };
  } finally { clearTimeout(timer); }
}

async function rows(client) {
  const result = {};
  for (const name of ARCHIVE_TABLES) result[name] = (await client.query(`SELECT * FROM ollama_gateway.${name} ORDER BY id`)).rows;
  return result;
}

// Synthetic rows exercise every table, including FK cycles and immutable triggers.
async function seedEvidence(database) {
  await database.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,
    installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
    SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,
      'synthetic','archive-fixture',clock_timestamp() FROM ollama_gateway.request_binding WHERE attempt=1`);
  await database.query(`UPDATE ollama_gateway.admission SET last_recovery_receipt=(SELECT id FROM ollama_gateway.recovery_receipt),
    cooldown_until=clock_timestamp()+interval '1 hour'`);
  await database.query(`INSERT INTO ollama_gateway.provider_stop_intent(binding_id,owner_id,attempts,network_id,
    configuration_hash,network_hash,operator_ref,evidence_ref,reviewed_at)
    SELECT id,owner_id,attempt,repeat('a',64),repeat('b',64),repeat('c',64),'synthetic','archive-fixture',now()
    FROM ollama_gateway.request_binding WHERE attempt=2`);
  await database.query(`INSERT INTO ollama_gateway.provider_stop_observation(intent_id,finished_at,exit_code)
    SELECT id,'2026-10-15T00:00:00.000Z',0 FROM ollama_gateway.provider_stop_intent`);
  await database.query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
    SELECT id,repeat('d',64),repeat('e',64) FROM ollama_gateway.request_binding WHERE attempt=3`);
}

export async function rehearseGatewayArchive(admin, database) {
  if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('isolated_fixture_required');
  await seedEvidence(database);
  const before = await rows(database), admission = before.admission[0];
  assert.equal(String(admission.attempts), '19'); assert.ok(admission.active_request);
  await admin.query('CREATE ROLE gateway_archive_fixture_reader LOGIN');
  await database.query(`GRANT USAGE ON SCHEMA ollama_gateway TO gateway_archive_fixture_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_archive_fixture_reader`);
  const configuration = { database: { host: '/var/run/postgresql', user: 'gateway_archive_fixture_reader', database: 'classifarr_gateway_fixture' },
    providerHash: admission.provider_hash, retentionDays: 90 };
  const parent = await mkdtemp('/tmp/gateway-archive-fixture-'), configFile = join(parent, 'config.json');
  await chmod(parent, 0o700); await writeFile(configFile, JSON.stringify(configuration), { mode: 0o600, flag: 'wx' });
  const env = { PATH: process.env.PATH, CLASSIFARR_GATEWAY_ARCHIVE_CONFIG_FILE: configFile };
  const cli = (...args) => command(process.execPath, ['/app/src/scripts/archiveOllamaGateway.mjs', ...args], env);
  const inspection = await cli('inspect'); assert.equal(inspection.code, 0, inspection.stderr);
  const report = JSON.parse(inspection.stdout);
  assert.equal(report.categories.active, 1); assert.equal(report.categories.lifecycle, 2); assert.equal(report.purgeAuthorized, false);
  const created = await cli('create', parent); assert.equal(created.code, 0, created.stderr);
  const receipt = JSON.parse(created.stdout), directory = join(parent, `gateway-archive-${receipt.archiveId}`);
  assert.match(receipt.archiveId, /^[a-f0-9-]{14}7/); assert.match(receipt.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  const dumpPath = join(directory, 'gateway.dump'), markerPath = join(directory, 'manifest.json');
  assert.equal((await stat(dumpPath)).mode & 0o777, 0o600);
  assert.equal((await stat(markerPath)).mode & 0o777, 0o600);
  const verified = await cli('verify', directory); assert.equal(verified.code, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).restoreVerified, false);
  assert.deepEqual(await rows(database), before);
  await assert.rejects(createArchiveDirectory(parent, receipt.archiveId), /gateway_archive_file_invalid/);
  await assert.rejects(openArchiveFile(directory, 'gateway.dump', true), /gateway_archive_file_invalid/);

  // Only a new disposable database receives SQL; integrity verification never executes SQL.
  await admin.query('CREATE DATABASE classifarr_gateway_archive_restore');
  const restored = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr_gateway_archive_restore' });
  try {
    const restore = await command('/usr/bin/pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
      '-h', '/var/run/postgresql', '-U', 'classifarr', '-d', 'classifarr_gateway_archive_restore', dumpPath], { PATH: process.env.PATH });
    assert.equal(restore.code, 0, 'isolated_restore_failed');
    await restored.connect(); assert.deepEqual(await rows(restored), before);
    for (const name of ARCHIVE_TABLES.filter(name => name !== 'admission')) {
      await assert.rejects(restored.query(`DELETE FROM ollama_gateway.${name}`), { code: '42501' });
    }
    const ledger = await openGatewayLedger(restored, admission.provider_hash);
    assert.equal((await ledger.status()).state, 'uncertain_or_active');
    await assert.rejects(ledger.claim('local'));
    assert.equal((await ledger.status()).attempts, '19');
    assert.equal((await ledger.status()).cooldownUntil.toISOString(), admission.cooldown_until.toISOString());
  } finally { await restored.end(); }

  const dump = await readFile(dumpPath), marker = await readFile(markerPath);
  await chmod(dumpPath, 0o644); assert.equal((await cli('verify', directory)).code, 1); await chmod(dumpPath, 0o600);
  await writeFile(dumpPath, Buffer.from('PGDMPwrong')); assert.equal((await cli('verify', directory)).code, 1); await writeFile(dumpPath, dump);
  await truncate(dumpPath, ARCHIVE_LIMIT + 1); assert.equal((await cli('verify', directory)).code, 1); await writeFile(dumpPath, dump);
  await writeFile(markerPath, 'x'.repeat(65537)); assert.equal((await cli('verify', directory)).code, 1); await writeFile(markerPath, marker);
  await link(dumpPath, join(directory, 'hardlink')); assert.equal((await cli('verify', directory)).code, 1); await unlink(join(directory, 'hardlink'));
  await unlink(markerPath); assert.equal((await cli('verify', directory)).code, 1);
  await symlink(configFile, markerPath); assert.equal((await cli('verify', directory)).code, 1);
  await unlink(markerPath); await writeFile(markerPath, marker, { mode: 0o600 });
  await symlink(directory, join(parent, 'linked')); assert.equal((await cli('verify', join(parent, 'linked'))).code, 1);
  const abort = new AbortController(); abort.abort(); await assert.rejects(verifyGatewayArchive(directory, abort.signal), /gateway_archive_cancelled/);
  assert.equal((await cli('verify', directory)).code, 0);
  const failedId = (await database.query('SELECT uuidv7() AS id')).rows[0].id;
  const failedDirectory = await createArchiveDirectory(parent, failedId);
  await assert.rejects(dumpGatewayArchive(configuration, '00000000-00000000-0', failedDirectory), /gateway_archive_dump_failed/);
  await assert.rejects(stat(join(failedDirectory, 'manifest.json')), { code: 'ENOENT' });
  assert.equal((await cli('verify', failedDirectory)).code, 1);
  assert.deepEqual(await rows(database), before);
  process.stdout.write('gateway_archive_passed: SELECT-only native snapshot dump, seven-table exact restore, immutable evidence, UUIDv7, uncertain work/counters/cooldown preserved, permissions/symlink/hardlink/corruption/size/incomplete/cancellation refusals; no provider calls\n');
  // All files/databases belong to the isolated container and are removed with it.
}
