/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { catalogRetentionRepository, assertArchiveNotCatalogPinned } from '../../ollamaGateway/catalogRetentionRepository.mjs';
import { archiveJobRepository } from '../../ollamaGateway/archiveJobRepository.mjs';
import { runArchiveAssessment } from '../../ollamaGateway/archiveCoordinator.mjs';
import { catalogSample, inventory, syntheticId, syntheticHash } from '../fixtures/gatewayCatalogRetention.mjs';

let client, ledgerId, archiveId, repository;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
  for (const name of ['ollama-gateway', 'ollama-gateway-archive', 'ollama-gateway-catalog']) {
    await client.query(await readFile(new URL(`../../../../database/${name}/current.sql`, import.meta.url), 'utf8'));
  }
  await client.query('SELECT pg_advisory_lock(11435,4)');
  ledgerId = (await client.query('SELECT id FROM ollama_gateway.admission')).rows[0].id;
  archiveId = (await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,manifest_sha256,manifest,receipt)
    VALUES($1,$2,$2,$2,1,'verified',$2,$3,'{}') RETURNING id`, [ledgerId, syntheticHash, { version: 4 }])).rows[0].id;
  repository = catalogRetentionRepository(client);
});
afterEach(async () => {
  try { await client.query('ROLLBACK; DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); }
  finally { client.release(true); }
});
function sample(n = 10, entries = inventory(archiveId)) { return catalogSample(syntheticId(n), ledgerId, entries); }
async function retain(n = 10, entries) {
  const value = sample(n, entries);
  return repository.register(value.manifest, value.manifestSha256, value.verification, value.entries);
}

test('timestamped installation matches fresh schema exactly', async () => {
  const base = new URL('../../../../database/ollama-gateway-catalog/', import.meta.url);
  const migrations = ['20261017_230000_catalog_retention.sql', '20261017_235000_catalog_jobs.sql'];
  expect((await readFile(new URL('current.sql', base), 'utf8')).replace(/\r\n/g, '\n').trim())
    .toBe((await Promise.all(migrations.map(name => readFile(new URL(name, base), 'utf8')))).map(text => text.replace(/\r\n/g, '\n').trim()).join('\n'));
});

test('native UUIDv7 registry is independent and duplicate registration is idempotent', async () => {
  const first = await retain(); expect((await retain()).id).toBe(first.id);
  const versions = (await client.query('SELECT uuid_extract_version(id) AS v FROM gateway_catalog.snapshot UNION ALL SELECT uuid_extract_version(id) FROM gateway_catalog.dependency')).rows;
  expect(versions).toHaveLength(4); expect(versions.every(row => row.v === 7)).toBe(true);
  expect(first.archive_id).not.toBe(first.id);
  expect(await repository.entries(first.id)).toEqual(inventory(archiveId));
  expect((await client.query('SELECT attempt,status FROM gateway_archive.job')).rows).toEqual([{ attempt: 1, status: 'verified' }]);
});

test('pins block repository retirement, direct mutation/deletion and truncation', async () => {
  await retain();
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow('gateway_catalog_dependency');
  await expect(archiveJobRepository(client).retiring(archiveId)).rejects.toThrow('gateway_catalog_dependency');
  for (const sql of ["UPDATE gateway_archive.job SET status='retiring'", 'DELETE FROM gateway_archive.job', 'TRUNCATE gateway_archive.job CASCADE']) {
    await expect(client.query(sql)).rejects.toThrow();
  }
  expect((await client.query('SELECT status FROM gateway_archive.job')).rows[0].status).toBe('verified');
});

test('retirement needs two later sets; shared pins survive one retirement and reconnect', async () => {
  const first = await retain(); await retain(11);
  await expect(repository.transition(first.id, 'retiring')).rejects.toThrow('gateway_catalog_rotation_blocked');
  await retain(12); await repository.transition(first.id, 'retiring');
  client.release(true); client = await getPool().connect(); repository = catalogRetentionRepository(client);
  await expect(repository.transition(first.id, 'retired')).rejects.toThrow('gateway_catalog_lock_required');
  await client.query('SELECT pg_advisory_lock(11435,4)');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow('gateway_catalog_dependency');
  await repository.transition(first.id, 'retired');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow('gateway_catalog_dependency');
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_catalog.dependency')).rows[0].n).toBe(9);
});

test('last pin releases only after retired, never retiring; no inference history is removed', async () => {
  const first = await retain(); await retain(11, []); await retain(12, []);
  await repository.transition(first.id, 'retiring');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow();
  await repository.transition(first.id, 'retired');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).resolves.toBeUndefined();
  await archiveJobRepository(client).retiring(archiveId);
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_archive.job')).rows[0].n).toBe(1);
});

test('three active roots bound replacement; foreign identities and reused identities refuse', async () => {
  await retain(); await retain(11); await retain(12);
  await expect(retain(13)).rejects.toThrow('gateway_catalog_registration_invalid');
  const value = sample(); value.manifestSha256 = 'b'.repeat(64); value.verification.manifestSha256 = value.manifestSha256;
  await expect(repository.register(value.manifest, value.manifestSha256, value.verification, value.entries)).rejects.toThrow();
  expect(await repository.list()).toHaveLength(3);
});

test('catalog roots cannot become dependencies; failed atomic registration leaves no partial pin', async () => {
  await client.query("UPDATE gateway_archive.job SET manifest=jsonb_build_object('version',5)");
  await expect(retain()).rejects.toThrow('gateway_catalog_dependency');
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n).toBe(0);
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_catalog.dependency')).rows[0].n).toBe(0);
});

test('registered index cannot be edited or extended after commit', async () => {
  const root = await retain();
  for (const sql of ['DELETE FROM gateway_catalog.dependency', "UPDATE gateway_catalog.dependency SET sha256=repeat('b',64)",
    'DELETE FROM gateway_catalog.snapshot', 'TRUNCATE gateway_catalog.snapshot CASCADE']) await expect(client.query(sql)).rejects.toThrow();
  await expect(client.query(`INSERT INTO gateway_catalog.dependency(snapshot_id,archive_id,kind,bytes,sha256)
    VALUES($1,$2,'protection',50,$3)`, [root.id, archiveId, syntheticHash])).rejects.toThrow('gateway_catalog_dependency');
});

test('missing lock and incomplete installation fail closed; legacy absent registry still works', async () => {
  await client.query('SELECT pg_advisory_unlock(11435,4)');
  await expect(retain()).rejects.toThrow('gateway_catalog_lock_required');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow('gateway_catalog_lock_required');
  await client.query('DROP SCHEMA gateway_catalog CASCADE');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).resolves.toBeUndefined();
  await client.query('CREATE SCHEMA gateway_catalog');
  await expect(assertArchiveNotCatalogPinned(client, archiveId)).rejects.toThrow();
});

test('a different maintenance session cannot bypass a retained pin or lock', async () => {
  await retain(); const other = await getPool().connect();
  try {
    expect((await other.query('SELECT pg_try_advisory_lock(11435,4) AS locked')).rows[0].locked).toBe(false);
    await expect(assertArchiveNotCatalogPinned(other, archiveId)).rejects.toThrow('gateway_catalog_lock_required');
    await expect(other.query("UPDATE gateway_archive.job SET status='retiring'")).rejects.toThrow('gateway_catalog_lock_required');
  } finally { other.release(true); }
});

test('legacy coordinator refuses new work with unintegrated catalog storage; no source call needed', async () => {
  await retain();
  expect(await runArchiveAssessment({ repository: archiveJobRepository(client) })).toEqual({
    state: 'catalog_retention_integration_required', purgeAuthorized: false,
  });
});

test('deferred completeness check rolls back a partial registration', async () => {
  const value = sample();
  await client.query('BEGIN');
  await client.query(`INSERT INTO gateway_catalog.snapshot(archive_id,ledger_id,provider_hash,policy_hash,
    manifest_sha256,manifest,verification,dependency_count) VALUES($1,$2,$3,$3,$4,$5,$6,3)`,
  [value.manifest.archiveId, ledgerId, syntheticHash, value.manifestSha256, value.manifest, value.verification]);
  await expect(client.query('COMMIT')).rejects.toThrow('gateway_catalog_registration_incomplete');
  await client.query('ROLLBACK');
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n).toBe(0);
});

test('cancelled registration rolls back rows and pins without touching attempts', async () => {
  const control = new AbortController();
  const wrapped = catalogRetentionRepository({ query: async (...args) => {
    const result = await client.query(...args);
    if (args[0].startsWith('INSERT INTO gateway_catalog.dependency')) control.abort();
    return result;
  } });
  const value = sample();
  await expect(wrapped.register(value.manifest, value.manifestSha256, value.verification, value.entries, control.signal)).rejects.toThrow();
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n).toBe(0);
  expect((await client.query('SELECT attempt FROM gateway_archive.job')).rows[0].attempt).toBe(1);
});
