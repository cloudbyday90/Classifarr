/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { catalogJobRepository } from '../../ollamaGateway/catalogJobRepository.mjs';
import { catalogRetentionRepository, hasCatalogRetention } from '../../ollamaGateway/catalogRetentionRepository.mjs';
import { archiveJobRepository } from '../../ollamaGateway/archiveJobRepository.mjs';
import { requiredCatalogArchives } from '../../ollamaGateway/catalogRecoveryFiles.mjs';
import { visitCatalogDependencyRows, visitCatalogRows } from '../../ollamaGateway/catalogRowReader.mjs';
import { runCatalogAssessment } from '../../ollamaGateway/catalogCoordinator.mjs';
import { archivePolicyHash } from '../../ollamaGateway/archiveSchedule.mjs';
import { catalogSample, syntheticHash } from '../fixtures/gatewayCatalogRetention.mjs';

let client, ledgerId, repository;
const schema = name => readFile(new URL(`../../../../database/${name}/current.sql`, import.meta.url), 'utf8');
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
  for (const name of ['ollama-gateway', 'ollama-gateway-archive', 'ollama-gateway-catalog']) await client.query(await schema(name));
  await client.query('SELECT pg_advisory_lock(11435,4)');
  ledgerId = (await client.query('SELECT id FROM ollama_gateway.admission')).rows[0].id;
  repository = catalogJobRepository(client);
});
afterEach(async () => {
  try { await client.query('ROLLBACK; DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); }
  finally { client.release(true); }
});
const begin = () => repository.begin({ ledgerId, providerHash: syntheticHash }, syntheticHash, syntheticHash, syntheticHash, [syntheticHash]);
async function inference(attempt = 1, revision = syntheticHash) {
  return (await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,manifest_sha256,manifest,receipt)
    VALUES($1,$2,$2,$3,$4,'verified',$2,'{"version":4}','{}') RETURNING *`, [ledgerId, syntheticHash, revision, attempt])).rows[0];
}
function capture(job) {
  const value = catalogSample(job.id, ledgerId, []);
  value.manifest.version = 6; value.manifest.catalog.version = 2; value.manifest.catalog.semanticSha256 = syntheticHash;
  value.manifest.catalog.tables['gateway_catalog.job'] = { count: 1, maxId: job.id, sha256: syntheticHash };
  return value;
}
test('native UUIDv7 independent admission consumes the original ordinal and fences legacy work', async () => {
  await inference(); const job = await begin(); expect(job.attempt).toBe(2);
  expect((await client.query('SELECT uuid_extract_version($1::uuid) AS v', [job.id])).rows[0].v).toBe(7);
  await expect(begin()).rejects.toThrow('gateway_catalog_admission_blocked');
  await expect(inference(3)).rejects.toThrow('gateway_catalog_capture_pending');
  await expect(client.query("UPDATE gateway_archive.job SET status='retiring'")).rejects.toThrow('gateway_catalog_capture_pending');
});
test('failure persists its original cooldown and cannot refund or delete an attempt', async () => {
  const job = await begin(); await repository.failed(job.id, 'cancelled');
  const failed = (await repository.list())[0]; expect(failed.attempt).toBe(1);
  expect(new Date(failed.retry_after) - new Date(failed.completed_at)).toBeGreaterThanOrEqual(299999);
  await expect(begin()).rejects.toThrow('gateway_catalog_budget_blocked');
  expect(await hasCatalogRetention(client)).toBe(true);
  for (const sql of ['DELETE FROM gateway_catalog.job', 'TRUNCATE gateway_catalog.job',
    'UPDATE gateway_catalog.job SET attempt=1,retry_after=NULL', "UPDATE gateway_catalog.job SET status='exporting'"]) await expect(client.query(sql)).rejects.toThrow();
});
test('incomplete publication and invalid failure reason are refused in SQL, not only in JavaScript', async () => {
  const job = await begin();
  await expect(client.query("UPDATE gateway_catalog.job SET status='awaiting_verification',manifest='{\"version\":6}',manifest_sha256=$1 WHERE id=$2", [syntheticHash, job.id]))
    .rejects.toThrow('gateway_catalog_job_fence');
  await expect(client.query("UPDATE gateway_catalog.job SET status='failed' WHERE id=$1", [job.id])).rejects.toThrow('gateway_catalog_job_fence');
  expect((await repository.list())[0].status).toBe('exporting');
});
test('successful legacy captures still exhaust the shared budget', async () => {
  await inference(1); await inference(2); await inference(3);
  await expect(begin()).rejects.toThrow(); expect(await repository.list()).toHaveLength(0);
});
test('restart preserves uncertainty and rejects a second capture even after reconnect', async () => {
  const job = await begin(); await repository.interrupted();
  client.release(true); client = await getPool().connect(); repository = catalogJobRepository(client);
  await client.query('SELECT pg_advisory_lock(11435,4)');
  expect((await repository.list())[0]).toMatchObject({ id: job.id, attempt: 1, status: 'interrupted' });
  await expect(begin()).rejects.toThrow('gateway_catalog_admission_blocked');
});
test('publication and registration are separate; acknowledgment reuses an existing registration', async () => {
  const job = await begin(), value = capture(job); await repository.published(job.id, value);
  await expect(repository.verified(job.id, value.verification)).rejects.toThrow('gateway_catalog_job_fence');
  const roots = catalogRetentionRepository(client);
  const first = await roots.register(value.manifest, value.manifestSha256, value.verification, []);
  expect((await roots.register(value.manifest, value.manifestSha256, value.verification, [])).id).toBe(first.id);
  await repository.verified(job.id, value.verification);
  const saved = (await repository.list())[0]; expect(saved.status).toBe('verified'); expect(saved.attempt).toBe(1);
  const legacy = await archiveJobRepository(client).begin({ ledgerId, providerHash: syntheticHash }, syntheticHash, syntheticHash);
  expect(legacy.attempt).toBe(2);
});
test('competing session cannot admit with a borrowed or missing maintenance lock', async () => {
  const other = await getPool().connect();
  try {
    await expect(catalogJobRepository(other).begin({ ledgerId, providerHash: syntheticHash }, syntheticHash, syntheticHash, syntheticHash, [syntheticHash]))
      .rejects.toThrow('gateway_catalog_lock_required');
  } finally { other.release(true); }
});
test('required set is latest two verified bundles, not all historical verified rows', async () => {
  const first = await inference(1), second = await inference(2), third = await inference(3);
  expect(await requiredCatalogArchives(client)).toEqual(new Set([second.id, third.id]));
  expect((await client.query('SELECT status FROM gateway_archive.job WHERE id=$1', [first.id])).rows[0].status).toBe('verified');
});

test('selective rows retain protected history plus newest two with deterministic timestamp ties', async () => {
  // SQL-only selection records; these are not claimed as restored file evidence.
  const older = [await inference(1,'b'.repeat(64)),await inference(2,'b'.repeat(64))];
  const tied = [await inference(1,'c'.repeat(64)),await inference(2,'c'.repeat(64)),await inference(3,'c'.repeat(64))];
  await client.query(`UPDATE gateway_archive.job SET created_at='2026-10-01',
    manifest='{"version":4,"retention":{"entries":[{}]}}',
    receipt=jsonb_build_object('version',2,'verified',true,'manifestSha256',manifest_sha256) WHERE revision=$1`,['b'.repeat(64)]);
  await client.query("UPDATE gateway_archive.job SET created_at='2026-10-02' WHERE revision=$1",['c'.repeat(64)]);
  await archiveJobRepository(client).protect(older,syntheticHash);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'");
  try {
    const selected = await requiredCatalogArchives(client);
    const expectedIds = [...older,...tied.sort((a,b) => a.id.localeCompare(b.id)).slice(-2)].map(row => row.id).sort();
    expect([...selected]).toEqual(expectedIds);
    const full = [], actual = [];
    await visitCatalogRows(client,0,row => full.push(row));
    await visitCatalogDependencyRows(client,row => actual.push(row),undefined,selected);
    expect(actual).toEqual(full.filter(row => selected.has(row.id)));
    const all = []; await visitCatalogDependencyRows(client,row => all.push(row));
    expect(all).toEqual(full);
  } finally { await client.query('ROLLBACK'); }
});

test.each(['provider', 'ledger'])('changed %s refuses pending acknowledgment before file access or mutation', async kind => {
  await client.query('UPDATE ollama_gateway.admission SET provider_hash=$1', [syntheticHash]);
  const policy = archivePolicyHash(90), jobLedger = kind === 'ledger' ? (await client.query('SELECT uuidv7() AS id')).rows[0].id : ledgerId;
  const job = await repository.begin({ ledgerId: jobLedger, providerHash: syntheticHash }, syntheticHash, policy, syntheticHash, [syntheticHash]);
  const value = capture(job); value.manifest.policyHash = policy; value.manifest.report.ledgerId = jobLedger;
  await repository.published(job.id, value);
  expect(await runCatalogAssessment({ source: client, maintenance: client, repository: archiveJobRepository(client),
    configuration: { retentionDays: 90, providerHash: kind === 'provider' ? 'b'.repeat(64) : syntheticHash }, paths: {}, signal: AbortSignal.timeout(1000) }))
    .toEqual({ state: 'identity_changed', purgeAuthorized: false });
  expect((await repository.list())[0]).toMatchObject({ id: job.id, status: 'awaiting_verification', attempt: 1 });
  expect(await catalogRetentionRepository(client).list()).toEqual([]);
});
