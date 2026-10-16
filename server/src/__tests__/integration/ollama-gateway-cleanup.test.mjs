/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { archiveJobRepository } from '../../ollamaGateway/archiveJobRepository.mjs';
import { captureRetentionInventory } from '../../ollamaGateway/archiveRetentionQueries.mjs';
import { withOnlineArchiveSnapshot } from '../../ollamaGateway/onlineArchive.mjs';
import { archivePolicyHash } from '../../ollamaGateway/archiveSchedule.mjs';
import { candidateBatchSha256 } from '../../ollamaGateway/archiveProtectionPolicy.mjs';
import { cleanupRepository,lockCleanupWorker } from '../../ollamaGateway/cleanupRepository.mjs';
import { checkCleanupRole } from '../../ollamaGateway/cleanupConfiguration.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';

let owner,worker,other,repository,hold,pair;
const configuration = { providerHash: 'e'.repeat(64),retentionDays: 90 };
const schema = name => readFile(new URL(`../../../../database/${name}/current.sql`,import.meta.url),'utf8');
beforeEach(async () => {
  owner = await getPool().connect(); other = await getPool().connect();
  await owner.query('DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
  if ((await owner.query("SELECT 1 FROM pg_roles WHERE rolname='classifarr_gateway_cleanup_owner'")).rowCount) {
    await owner.query('DROP OWNED BY classifarr_gateway_cleanup_owner; DROP ROLE classifarr_gateway_cleanup_owner');
  }
  await owner.query(await schema('ollama-gateway')); await owner.query(await schema('ollama-gateway-archive'));
  await owner.query(`UPDATE ollama_gateway.admission SET provider_hash=$1,owner_id=uuidv7(),attempts=80000,binding_count=80000`,[configuration.providerHash]);
  await owner.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,uuidv7(),owner_id,provider_hash,'synthetic',clock_timestamp()-CASE WHEN i<=100 THEN interval '100 days' ELSE interval '1 day' END,i,'unbound'
    FROM ollama_gateway.admission CROSS JOIN generate_series(1,80000) i;
    INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding WHERE attempt<=100;
    INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
    SELECT id,repeat('a',64),repeat('b',64) FROM ollama_gateway.request_binding WHERE attempt=1`);
  const archives = archiveJobRepository(owner);
  for (let i=0;i<2;i++) {
    const data = await withOnlineArchiveSnapshot(owner,configuration,async value => ({ ...value,retention: await captureRetentionInventory(owner,value.report) }));
    const job = await archives.begin(data.report,data.revision,archivePolicyHash(90));
    // SQL fixture only; file/restore proof is tested by the isolated image rehearsal, never forged there.
    const manifest = { version: 4,retention: data.retention,report: data.report };
    await archives.published(job.id,{ manifest,manifestSha256: 'b'.repeat(64) });
    await archives.verified(job.id,{ version: 2,verified: true,manifestSha256: 'b'.repeat(64) });
  }
  pair = await archives.list(); hold = await archives.protect(pair,candidateBatchSha256(pair[0].manifest.retention)); await archives.ready(hold.id);
  await owner.query(await schema('ollama-gateway-cleanup'));
  await owner.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cleanup_test_worker') THEN CREATE ROLE cleanup_test_worker LOGIN PASSWORD 'synthetic-cleanup-only'; END IF; END $$;
    GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO cleanup_test_worker;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO cleanup_test_worker;
    GRANT EXECUTE ON FUNCTION gateway_cleanup.admit(uuid,text,text,text),gateway_cleanup.execute_batch(uuid,integer),gateway_cleanup.reconcile(uuid) TO cleanup_test_worker`);
  worker = new pg.Client({ ...getPool().options,user: 'cleanup_test_worker',password: 'synthetic-cleanup-only' });
  await worker.connect(); await checkCleanupRole(worker); await lockCleanupWorker(worker);
  await worker.query('SELECT pg_advisory_lock(11435,4)'); repository = cleanupRepository(worker);
});
afterEach(async () => {
  await worker?.end(); other?.release(true);
  try {
    await owner.query('ROLLBACK');
    await owner.query('DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
    await owner.query('DROP OWNED BY classifarr_gateway_cleanup_owner,cleanup_test_worker; DROP ROLE classifarr_gateway_cleanup_owner,cleanup_test_worker');
  } finally { owner?.release(true); }
});
const admit = () => repository.admit(hold,archivePolicyHash(90));

test('atomic exact deletion preserves lifetime attempts and confirms only after commit',async () => {
  const before = (await owner.query('SELECT to_jsonb(a) AS value FROM ollama_gateway.admission a')).rows[0].value;
  const op = await admit();
  await worker.query("BEGIN; SET LOCAL synchronous_commit='off'"); const completed = await repository.execute(op);
  expect((await worker.query('SHOW synchronous_commit')).rows[0].synchronous_commit).toBe('on');
  expect(completed.deleted_bindings).toBe(100); expect(completed.deleted_completions).toBe(100);
  expect(completed.deleted_peers).toBe(1);
  expect(completed.confirmed_at).toBeNull();
  await expect(repository.reconcile(op.id)).rejects.toThrow('gateway_cleanup_commit_unconfirmed');
  await worker.query('ROLLBACK');
  expect((await owner.query('SELECT binding_count FROM ollama_gateway.admission')).rows[0].binding_count).toBe(80000);
  await repository.execute(op);
  const confirmed = await repository.reconcile(op.id);
  expect(confirmed.confirmed_at.getTime()).toBeGreaterThanOrEqual(confirmed.completed_at.getTime());
  expect((await owner.query('SELECT uuid_extract_version($1::uuid) AS v',[op.id])).rows[0].v).toBe(7);
  expect((await owner.query('SELECT to_jsonb(a) AS value FROM ollama_gateway.admission a')).rows[0].value).toEqual({ ...before,binding_count: 79900 });
  expect(await repository.execute(op)).toEqual(confirmed);
  expect((await repository.list())).toHaveLength(1);
});

test('unacknowledged completion is recovered without repeating deletion or changing the clock',async () => {
  const op = await admit(); await repository.execute(op);
  await worker.query('SELECT pg_advisory_unlock_all()'); await lockCleanupWorker(other); await other.query('SELECT pg_advisory_lock(11435,4)');
  const resumed = cleanupRepository(other), confirmed = await resumed.reconcile(op.id);
  expect(confirmed.status).toBe('completed'); expect(confirmed.confirmed_at).not.toBeNull();
  expect(await resumed.reconcile(op.id)).toEqual(confirmed);
  expect((await owner.query('SELECT count(*)::integer AS n FROM ollama_gateway.request_binding')).rows[0].n).toBe(79900);
});

test('restart preserves failed attempt and cooldown; exhausted attempts never reset',async () => {
  const op = await admit(); const failed = await repository.reconcile(op.id);
  expect(failed.attempt).toBe(1); expect(failed.status).toBe('failed');
  await expect(admit()).rejects.toThrow('gateway_cleanup_cooldown');
  // Explicit fixture clock advancement, not elapsed cooldown and not a counter reset.
  for (let attempt=2;attempt<=3;attempt++) {
    await owner.query("UPDATE gateway_cleanup.operation SET last_attempt_at=clock_timestamp()-interval '1 hour',retry_after=clock_timestamp()-interval '1 second'");
    const next = await admit(); expect(next.attempt).toBe(attempt); await repository.reconcile(next.id);
  }
  await expect(admit()).rejects.toThrow('gateway_cleanup_attempts_exhausted');
  expect((await owner.query('SELECT attempts,binding_count FROM ollama_gateway.admission')).rows[0]).toEqual({ attempts: 80000,binding_count: 80000 });
});

test('active or newly changed rows refuse the entire batch',async () => {
  const op = await admit();
  await owner.query(`UPDATE ollama_gateway.admission SET active_request=$1,installation='synthetic',started_at=clock_timestamp()`,[pair[0].manifest.retention.entries[0].requestId]);
  await expect(repository.execute(op)).rejects.toThrow('gateway_cleanup_candidates_changed');
  expect((await owner.query('SELECT binding_count FROM ollama_gateway.admission')).rows[0].binding_count).toBe(80000);
  await owner.query('UPDATE ollama_gateway.admission SET active_request=NULL,installation=NULL,started_at=NULL');
  await owner.query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256) VALUES($1,$2,$2)`,
    [pair[0].manifest.retention.entries[1].bindingId,'a'.repeat(64)]);
  await expect(repository.execute(op)).rejects.toThrow('gateway_cleanup_candidates_changed');
});

test('competing inference yields immediately and archive writes require maintenance exclusion',async () => {
  const op = await admit(); await other.query('BEGIN; SELECT * FROM ollama_gateway.admission FOR UPDATE');
  await expect(repository.execute(op)).rejects.toMatchObject({ code: '55P03' }); await other.query('ROLLBACK');
  await expect(other.query("UPDATE gateway_archive.job SET reason=reason")).rejects.toThrow('gateway_cleanup_maintenance_lock_required');
  await expect(lockCleanupWorker(other)).rejects.toThrow('gateway_cleanup_worker_running');
  expect((await other.query('SELECT pg_try_advisory_lock(11435,4) AS acquired')).rows[0].acquired).toBe(false);
  await repository.execute(op);
});

test('restricted worker cannot mutate history, receipts, counters, roles or run without both locks',async () => {
  for (const sql of ['DELETE FROM ollama_gateway.request_binding','UPDATE ollama_gateway.admission SET attempts=0',
    'DELETE FROM gateway_cleanup.operation','SET ROLE classifarr_gateway_cleanup_owner','TRUNCATE ollama_gateway.completion_receipt']) {
    await expect(worker.query(sql)).rejects.toMatchObject({ code: '42501' });
  }
  await expect(owner.query('DELETE FROM ollama_gateway.request_binding WHERE false')).rejects.toThrow('gateway_receipt_append_only');
  await worker.query('SELECT pg_advisory_unlock(11435,4)'); await expect(admit()).rejects.toThrow('gateway_cleanup_lock_required');
});

test('a newer unprotected archive blocks deletion and optional fresh schema equals its migration',async () => {
  const op = await admit();
  await worker.query('SELECT pg_advisory_unlock(11435,4)'); await owner.query('SELECT pg_advisory_lock(11435,4)');
  await archiveJobRepository(owner).begin(pair[0].manifest.report,'f'.repeat(64),archivePolicyHash(90));
  await owner.query('SELECT pg_advisory_unlock(11435,4)'); await worker.query('SELECT pg_advisory_lock(11435,4)');
  await expect(repository.execute(op)).rejects.toThrow('gateway_cleanup_archive_boundary');
  expect(await schema('ollama-gateway-cleanup')).toBe(await readFile(new URL('../../../../database/ollama-gateway-cleanup/20261016_210000_terminal_cleanup.sql',import.meta.url),'utf8'));
});

test('replacement recovery pairs preserve the exact batch retry budget',async () => {
  const original = await admit(); await repository.reconcile(original.id);
  await worker.query('SELECT pg_advisory_unlock(11435,4)'); await owner.query('SELECT pg_advisory_lock(11435,4)');
  const archives = archiveJobRepository(owner);
  for (let i=0;i<2;i++) {
    const job = await archives.begin(pair[0].manifest.report,'f'.repeat(64),archivePolicyHash(90));
    await archives.published(job.id,{ manifest: pair[0].manifest,manifestSha256: 'c'.repeat(64) });
    await archives.verified(job.id,{ version: 2,verified: true,manifestSha256: 'c'.repeat(64) });
  }
  const newer = (await archives.list()).slice(-2);
  const replacement = await archives.protect(newer,hold.candidates_sha256); await archives.ready(replacement.id);
  await owner.query("UPDATE gateway_cleanup.operation SET last_attempt_at=clock_timestamp()-interval '1 hour',retry_after=clock_timestamp()-interval '1 second'");
  await owner.query('SELECT pg_advisory_unlock(11435,4)'); await worker.query('SELECT pg_advisory_lock(11435,4)');
  const resumed = await repository.admit(replacement,archivePolicyHash(90));
  expect(resumed.id).toBe(original.id); expect(resumed.attempt).toBe(2); expect(resumed.protection_id).toBe(replacement.id);
  expect((await repository.execute(resumed)).deleted_bindings).toBe(100);
});

test('new lifecycle evidence and counter drift block cleanup without partial deletion',async () => {
  const op = await admit();
  await owner.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,
    installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
    SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,
      'fixture','late-recovery',clock_timestamp() FROM ollama_gateway.request_binding WHERE attempt=1`);
  await expect(repository.execute(op)).rejects.toThrow('gateway_cleanup_candidates_changed');
  await owner.query('UPDATE ollama_gateway.admission SET binding_count=80001');
  await expect(repository.execute(op)).rejects.toThrow('gateway_cleanup_source_changed');
  expect((await owner.query('SELECT count(*)::integer AS n FROM ollama_gateway.completion_receipt')).rows[0].n).toBe(100);
});

test('real inference claims and completions continue with lifetime attempts intact after cleanup',async () => {
  await other.query("SET statement_timeout='4s'");
  const ledger = await openGatewayLedger(other,configuration.providerHash), op = await admit();
  await worker.query('BEGIN'); await repository.execute(op);
  const claiming = ledger.claim('synthetic');
  await worker.query('COMMIT');
  const request = await claiming; expect(request).toBeTruthy();
  await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 });
  const status = await ledger.status();
  expect(status.state).toBe('ready'); expect(status.attempts).toBe('80001'); expect(status.bindingCount).toBe(79901);
  expect((await owner.query('SELECT attempt::text FROM ollama_gateway.request_binding WHERE request_id=$1',[request])).rows[0].attempt).toBe('80001');
});
