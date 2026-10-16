/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { archiveJobRepository,lockArchiveCoordinator } from '../../ollamaGateway/archiveJobRepository.mjs';
import { withOnlineArchiveSnapshot } from '../../ollamaGateway/onlineArchive.mjs';
import { captureArchiveContent } from '../../ollamaGateway/archiveContent.mjs';
import { captureRetentionInventory } from '../../ollamaGateway/archiveRetentionQueries.mjs';
import { retentionInventorySha256 } from '../../ollamaGateway/archiveRetentionContract.mjs';
import { candidateBatchSha256 } from '../../ollamaGateway/archiveProtectionPolicy.mjs';
import { archivePolicyHash } from '../../ollamaGateway/archiveSchedule.mjs';

let fixture,owner,other,repository,pair,configuration,batch;
const schema = name => readFile(new URL(`../../../../database/ollama-gateway-archive/${name}`,import.meta.url),'utf8');
beforeEach(async () => {
  fixture = await createOllamaApplicationFixture(getPool()); owner = await getPool().connect(); other = await getPool().connect();
  await owner.query('DROP SCHEMA IF EXISTS gateway_archive CASCADE'); await owner.query(await schema('current.sql'));
  repository = archiveJobRepository(owner); await repository.assertSchema();
  // Seed old synthetic records; never rewrite append-only inference history or refund attempts.
  await owner.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,uuidv7(),owner_id,provider_hash,'synthetic',clock_timestamp()-interval '100 days',1,'unbound' FROM ollama_gateway.admission;
    INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding;
    UPDATE ollama_gateway.admission SET attempts=1,binding_count=1`);
  configuration = { providerHash: (await owner.query('SELECT provider_hash FROM ollama_gateway.admission')).rows[0].provider_hash,retentionDays: 90 };
  pair = [];
  for (let i=0;i<2;i++) {
    const data = await withOnlineArchiveSnapshot(owner,configuration,async value => ({ ...value,
      content: await captureArchiveContent(owner),retention: await captureRetentionInventory(owner,value.report) }));
    const job = await repository.begin(data.report,data.revision,archivePolicyHash(90));
    const manifest = { version: 4,schemaVersion: 7,archiveId: job.id,policyHash: job.policy_hash,revision: job.revision,
      report: data.report,content: data.content,retention: data.retention,predecessors: [],
      dump: { name: 'gateway.dump',bytes: 5,sha256: 'a'.repeat(64) } };
    await repository.published(job.id,{ manifest,manifestSha256: 'b'.repeat(64) });
    await repository.verified(job.id,{ version: 2,archiveId: job.id,manifestSha256: 'b'.repeat(64),dumpSha256: 'a'.repeat(64),
      verified: true,preserves: [],purgeAuthorized: false,retentionSha256: retentionInventorySha256(data.retention) });
  }
  pair = await repository.list(); batch = candidateBatchSha256(pair[0].manifest.retention);
});
afterEach(async () => { owner?.release(true); other?.release(true); await fixture?.close(); });

test('native UUIDv7 holds protect both jobs atomically, remain indefinite, and preserve inference',async () => {
  const before = (await owner.query('SELECT to_jsonb(a) AS value FROM ollama_gateway.admission a')).rows[0].value;
  const hold = await repository.protect(pair,batch);
  expect((await owner.query('SELECT uuid_extract_version($1::uuid) AS v',[hold.id])).rows[0].v).toBe(7);
  expect(hold.minimum_recovery_days).toBe(30); expect(hold.ready_at).toBeNull();
  expect((await repository.list()).every(job => job.recovery_protection_id === hold.id)).toBe(true);
  await repository.ready(hold.id);
  for (const sql of ["UPDATE gateway_archive.job SET status='retiring'",'DELETE FROM gateway_archive.job',
    'UPDATE gateway_archive.job SET recovery_protection_id=NULL',"UPDATE gateway_archive.job SET manifest='{}'",
    'DELETE FROM gateway_archive.protection','TRUNCATE gateway_archive.protection CASCADE',
    "UPDATE gateway_archive.protection SET created_at=clock_timestamp()-interval '40 days'",
    'UPDATE gateway_archive.protection SET ready_at=NULL']) await expect(owner.query(sql)).rejects.toThrow('gateway_archive_protection_immutable');
  await expect(repository.ready(hold.id)).rejects.toThrow('gateway_archive_protection_fence');
  expect((await owner.query('SELECT to_jsonb(a) AS value FROM ollama_gateway.admission a')).rows[0].value).toEqual(before);
  expect(fixture.calls).toHaveLength(0);
});

test('retirement wins first: stale protection request cannot claim the retired job',async () => {
  await other.query('BEGIN'); await archiveJobRepository(other).retiring(pair[0].id);
  const pending = repository.protect(pair,batch);
  await other.query('COMMIT'); await expect(pending).rejects.toThrow('gateway_archive_protection_invalid');
  expect((await owner.query('SELECT count(*)::int AS n FROM gateway_archive.protection')).rows[0].n).toBe(0);
});

test.each(['READ COMMITTED','REPEATABLE READ'])('protection wins: competing %s retirement cannot bypass the job fence',async isolation => {
  await other.query(`BEGIN ISOLATION LEVEL ${isolation}`); await other.query('SELECT * FROM gateway_archive.job');
  await owner.query('BEGIN'); const hold = await repository.protect(pair,batch);
  const pending = archiveJobRepository(other).retiring(pair[0].id);
  await owner.query('COMMIT');
  await expect(pending).rejects.toThrow(isolation === 'READ COMMITTED' ? 'gateway_archive_protection_immutable' : 'could not serialize access');
  await other.query('ROLLBACK');
  expect((await repository.list())[0].recovery_protection_id).toBe(hold.id);
});

test('duplicate protection, unverified/mismatched evidence, and concurrent admission refuse safely',async () => {
  await expect(repository.protect([pair[0],{ ...pair[1],manifest_sha256: 'c'.repeat(64) }],batch)).rejects.toThrow('gateway_archive_protection_invalid');
  await owner.query("UPDATE gateway_archive.job SET receipt=jsonb_set(receipt,'{verified}','false') WHERE id=$1",[pair[1].id]);
  await expect(repository.protect(pair,batch)).rejects.toThrow('gateway_archive_protection_invalid');
  await owner.query("UPDATE gateway_archive.job SET receipt=jsonb_set(receipt,'{verified}','true') WHERE id=$1",[pair[1].id]);
  await other.query('BEGIN; SELECT pg_advisory_xact_lock(11435,3)');
  await expect(repository.protect(pair,batch)).rejects.toThrow('gateway_archive_protection_busy');
  await other.query('ROLLBACK'); await repository.protect(pair,batch);
  await expect(repository.protect(pair,batch)).rejects.toThrow('gateway_archive_protection_invalid');
});

test('explicit v1 upgrade preserves attempts/evidence and refuses a running coordinator',async () => {
  await owner.query('DROP SCHEMA gateway_archive CASCADE');
  await owner.query(await schema('20261016_120000_archive_jobs.sql'));
  const data = await withOnlineArchiveSnapshot(owner,configuration,async value => value);
  const created = await repository.begin(data.report,data.revision,archivePolicyHash(90)); await repository.failed(created.id,'export_failed');
  await expect(repository.assertSchema()).rejects.toThrow('gateway_archive_protection_schema_required');
  const before = (await owner.query('SELECT * FROM gateway_archive.job')).rows[0];
  await lockArchiveCoordinator(other);
  await expect(owner.query(await schema('20261016_170000_archive_protection.sql'))).rejects.toThrow('gateway_archive_upgrade_blocked');
  await owner.query('ROLLBACK'); await other.query('SELECT pg_advisory_unlock(11435,2)');
  await owner.query(await schema('20261016_170000_archive_protection.sql')); await repository.assertSchema();
  const { recovery_protection_id,...after } = (await owner.query('SELECT * FROM gateway_archive.job')).rows[0];
  expect(after).toEqual(before); expect(recovery_protection_id).toBeNull();
});

test('fresh schema equals the explicit upgrade sequence',async () => {
  expect(await schema('current.sql')).toBe(`${await schema('20261016_120000_archive_jobs.sql')}${await schema('20261016_170000_archive_protection.sql')}`);
});

test('schema upgrade refuses an in-flight retirement before adding protection structures',async () => {
  await owner.query('DROP SCHEMA gateway_archive CASCADE'); await owner.query(await schema('20261016_120000_archive_jobs.sql'));
  const j = pair[0];
  await owner.query(`INSERT INTO gateway_archive.job(id,ledger_id,provider_hash,policy_hash,revision,attempt,status,manifest_sha256,manifest,receipt)
    VALUES($1,$2,$3,$4,$5,1,'retiring',$6,$7,$8)`,[j.id,j.ledger_id,j.provider_hash,j.policy_hash,j.revision,j.manifest_sha256,j.manifest,j.receipt]);
  await expect(owner.query(await schema('20261016_170000_archive_protection.sql'))).rejects.toThrow('gateway_archive_upgrade_blocked');
  await owner.query('ROLLBACK');
  expect((await owner.query("SELECT to_regclass('gateway_archive.protection') AS table")).rows[0].table).toBeNull();
});
