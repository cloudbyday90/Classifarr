/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile,link,unlink,readdir } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { candidateBatchSha256 } from '/app/src/ollamaGateway/archiveProtectionPolicy.mjs';
import { ensureArchiveProtection } from '/app/src/ollamaGateway/archiveProtectionFiles.mjs';
import { retireManagedArchive } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
const action = process.argv[2], database = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'gateway_online_archive_fixture' });
const writer = new pg.Client({ host: '/var/run/postgresql',user: 'archive_fixture_writer',database: 'gateway_online_archive_fixture' });
try {
  await database.connect(); await writer.connect(); const repository = archiveJobRepository(writer);
  if (action === 'stage') {
    // Scheduling fixture only, before immutable holds exist. No counter/attempt refund.
    await database.query("UPDATE gateway_archive.job SET completed_at=clock_timestamp()-interval '25 hours' WHERE status='verified'");
    const pair = (await repository.list()).filter(job => job.status === 'verified'); assert.equal(pair.length,2);
    const digest = candidateBatchSha256(pair[0].manifest.retention);
    assert.equal(candidateBatchSha256(pair[1].manifest.retention),digest);
    await repository.protect(pair,digest);
    const first = (await repository.list()).find(job => job.id === pair[0].id);
    const directory = `/archives/gateway-archive-${first.id}`;
    await ensureArchiveProtection(directory,first);
    await link(`${directory}/protection.json`,`${directory}/protection.pending`);
    // Exact crash boundaries: SQL committed; first marker linked but pending not removed; second absent.
    assert.equal((await database.query('SELECT ready_at FROM gateway_archive.protection')).rows[0].ready_at,null);
  } else if (action === 'check') {
    const held = (await repository.list()).filter(job => job.recovery_protection_id); assert.equal(held.length,2);
    for (const job of held) {
      assert.ok(job.protection.ready_at); assert.equal(job.protection.minimum_recovery_days,30);
      const directory = `/archives/gateway-archive-${job.id}`, markerPath = `${directory}/protection.json`;
      assert.deepEqual((await readdir(directory)).sort(),['gateway.dump','manifest.json','protection.json']);
      await assert.rejects(repository.retiring(job.id),/gateway_archive_protection_immutable/);
      await assert.rejects(retireManagedArchive('/archives',{ ...job,status: 'retiring' }),/gateway_archive_rotation_blocked/);
      await assert.rejects(ensureArchiveProtection(directory,{ ...job,recovery_protection_id: null,protection: null }),/gateway_archive_protection_fence/);
      const original = await readFile(markerPath,'utf8'); await writeFile(markerPath,'{}');
      await assert.rejects(ensureArchiveProtection(directory,job),/gateway_archive_protection_fence/);
      await writeFile(markerPath,original);
      await unlink(markerPath);
      await assert.rejects(ensureArchiveProtection(directory,job),/gateway_archive_protection_fence/);
      await writeFile(markerPath,original,{ mode: 0o600,flag: 'wx' });
      await ensureArchiveProtection(directory,{ ...job,protection: { ...job.protection,created_at: '2000-01-01T00:00:00Z' } });
    }
    for (const sql of ['DELETE FROM gateway_archive.protection','TRUNCATE gateway_archive.protection',
      'UPDATE gateway_archive.protection SET minimum_recovery_days=1']) await assert.rejects(writer.query(sql),{ code: '42501' });
  } else if (action === 'retirement-cut') {
    const jobs = await repository.list(), pending = jobs.find(job => job.status === 'awaiting_verification');
    const receipt = JSON.parse(await readFile(`/receipts/${pending.id}.json`,'utf8'));
    await repository.verified(pending.id,receipt);
    const prior = jobs.find(job => job.status === 'verified' && !job.recovery_protection_id);
    assert.ok(receipt.preserves.includes(prior.id)); await repository.retiring(prior.id);
    await unlink(`/archives/gateway-archive-${prior.id}/manifest.json`);
  } else if (action === 'rotated') {
    const jobs = await repository.list(), held = jobs.filter(job => job.recovery_protection_id);
    assert.equal(held.length,2); assert.ok(held.every(job => job.status === 'verified'));
    assert.equal(jobs.filter(job => job.status === 'verified').length,4);
    assert.equal((await readdir('/archives')).length,4);
    assert.equal(jobs[4].status,'retired'); assert.equal(jobs[4].recovery_protection_id,null);
    assert.equal((await database.query('SELECT count(*)::int AS n FROM ollama_gateway.request_binding')).rows[0].n,109);
  } else throw new Error('protection_fixture_action_invalid');
  process.stdout.write(`archive_protection_${action}_passed\n`);
} finally { await writer.end(); await database.end(); }
