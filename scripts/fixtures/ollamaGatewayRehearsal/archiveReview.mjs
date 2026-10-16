/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import pg from '/app/node_modules/pg/lib/index.js';
import { ARCHIVE_TABLES } from '/app/src/ollamaGateway/archiveContract.mjs';

export async function rehearseGatewayRetentionReview(admin, command) {
  if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('isolated_fixture_required');
  await admin.query('CREATE DATABASE classifarr_gateway_review_fixture');
  const database = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr_gateway_review_fixture' });
  try {
    await database.connect(); await database.query(await readFile('/app/database/ollama-gateway/current.sql', 'utf8'));
    await database.query(`UPDATE ollama_gateway.admission SET provider_hash=repeat('d',64),owner_id=uuidv7(),attempts=2,binding_count=2;
      INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
        SELECT a.id,uuidv7(),owner_id,provider_hash,'synthetic',now()-interval '100 days',n,'unbound'
        FROM ollama_gateway.admission a CROSS JOIN generate_series(1,2) n;
      INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
        SELECT request_id,'response_completed',200,now()-interval '100 days' FROM ollama_gateway.request_binding WHERE attempt=1;
      UPDATE ollama_gateway.admission SET active_request=(SELECT request_id FROM ollama_gateway.request_binding WHERE attempt=2),
        installation='synthetic',started_at=now(),cooldown_until=now()+interval '1 hour';
      GRANT USAGE ON SCHEMA ollama_gateway TO gateway_archive_fixture_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_archive_fixture_reader`);
    const rows = async () => {
      const result = [];
      for (const name of ARCHIVE_TABLES) result.push((await database.query(`SELECT * FROM ollama_gateway.${name} ORDER BY id`)).rows);
      return result;
    };
    const before = await rows(), parent = await mkdtemp('/tmp/gateway-review-fixture-'); await chmod(parent, 0o700);
    const configFile = join(parent, 'config.json');
    const configuration = { database: { host: '/var/run/postgresql', user: 'gateway_archive_fixture_reader', database: 'classifarr_gateway_review_fixture' },
      providerHash: 'd'.repeat(64), retentionDays: 90 };
    await writeFile(configFile, JSON.stringify(configuration), { mode: 0o600, flag: 'wx' });
    const cli = (...args) => command(process.execPath, ['/app/src/scripts/archiveOllamaGateway.mjs', ...args],
      { PATH: process.env.PATH, CLASSIFARR_GATEWAY_ARCHIVE_CONFIG_FILE: configFile });
    const created = await cli('create', parent); assert.equal(created.code, 0, created.stderr);
    const receipt = JSON.parse(created.stdout), directory = join(parent, `gateway-archive-${receipt.archiveId}`);
    const markerPath = join(directory, 'manifest.json'), marker = await readFile(markerPath), manifest = JSON.parse(marker);
    assert.equal(manifest.version, 2); assert.equal(manifest.retention.entries.length, 1);
    assert.equal(manifest.retention.entries[0].attempt, '1');
    const checked = await cli('review', directory, receipt.manifestSha256); assert.equal(checked.code, 0, checked.stderr);
    const plan = JSON.parse(checked.stdout); assert.equal(plan.status, 'ready_for_review');
    assert.match(plan.reviewId, /^[a-f0-9-]{14}7/); assert.equal(plan.purgeAuthorized, false); assert.equal(plan.restoreVerified, false);
    assert.equal(plan.entries[0].status, 'matched'); assert.deepEqual(await rows(), before);
    const wrongHash = await cli('review', directory, 'e'.repeat(64)); assert.equal(wrongHash.code, 1);
    assert.equal(wrongHash.stderr.trim(), 'gateway_archive_review_hash_mismatch');
    assert.equal((await cli('review', directory, 'invalid')).code, 1);
    assert.equal((await cli('review', directory)).code, 1);
    assert.equal((await cli('inspect', directory)).code, 1);

    // Restore the exact archived bytes to a new isolated database; its row fingerprints must match.
    await admin.query('CREATE DATABASE classifarr_gateway_review_restore');
    const restore = await command('/usr/bin/pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
      '-h', '/var/run/postgresql', '-U', 'classifarr', '-d', 'classifarr_gateway_review_restore', join(directory, 'gateway.dump')], { PATH: process.env.PATH });
    assert.equal(restore.code, 0, 'isolated_review_restore_failed');
    // This disposable restore uses the fixture owner, not a production credential.
    await writeFile(configFile, JSON.stringify({ ...configuration, database: { ...configuration.database, user: 'classifarr', database: 'classifarr_gateway_review_restore' } }));
    const restoredReview = await cli('review', directory, receipt.manifestSha256); assert.equal(restoredReview.code, 0, restoredReview.stderr);
    assert.equal(JSON.parse(restoredReview.stdout).status, 'ready_for_review');
    await writeFile(configFile, JSON.stringify(configuration));
    assert.deepEqual(await rows(), before);

    // New evidence changes eligibility; the old archive never grants deletion authority.
    await database.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,
      installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
      SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,
        'synthetic','review-fixture',now() FROM ollama_gateway.request_binding WHERE attempt=1`);
    const protectedRows = await rows(), drift = await cli('review', directory, receipt.manifestSha256);
    assert.equal(drift.code, 0, drift.stderr); assert.equal(JSON.parse(drift.stdout).status, 'blocked');
    assert.equal(JSON.parse(drift.stdout).entries[0].status, 'protected'); assert.deepEqual(await rows(), protectedRows);

    // Existing v1 archives retain verification compatibility, but lack review evidence.
    const { retention: _retention, ...legacy } = manifest;
    const legacyBytes = JSON.stringify({ ...legacy, version: 1 }); await writeFile(markerPath, legacyBytes);
    assert.equal((await cli('verify', directory)).code, 0);
    const legacyReview = await cli('review', directory, createHash('sha256').update(legacyBytes).digest('hex'));
    assert.equal(legacyReview.code, 1); assert.equal(legacyReview.stderr.trim(), 'gateway_archive_review_requires_inventory');
    assert.equal((await cli('review', directory, receipt.manifestSha256)).stderr.trim(), 'gateway_archive_review_hash_mismatch');
    await writeFile(markerPath, marker);
    process.stdout.write('gateway_retention_review_passed: v2 exact inventory, trusted manifest hash, UUIDv7 review, SELECT-only matched/protected reads, actual restored-row match, legacy v1 verification, no deletion or provider work\n');
  } finally { await database.end(); }
}
