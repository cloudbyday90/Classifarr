/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import pg from 'pg';
import * as db from '../../config/database.mjs';
import { createFreshInventoryPolicyRepository, fingerprintFreshPolicySnapshot, FRESH_POLICY_CONFIG_SQL, loadFreshInventoryPolicyRuntime } from '../../services/freshInventoryPolicyRuntime.mjs';
import { freshFixture } from '../fixtures/freshInventoryPolicyFixture.mjs';

function setup() {
  const { source } = freshFixture();
  const client = { query: jest.fn(async sql => ({ rows: sql.includes('FROM media_server_items msi') ? source.evaluationRows
    : sql.includes('SELECT id, name') ? source.libraries
      : sql === FRESH_POLICY_CONFIG_SQL ? [source.config]
        : sql.includes('embedding::text') ? [...source.vectors].map(([description_hash, embedding]) => ({ description_hash, embedding: JSON.stringify(embedding) })) : [] })) };
  const withTransaction = jest.fn(async callback => callback(client));
  const loadPolicies = jest.fn(async () => source.policies);
  return { source, client, withTransaction, loadPolicies,
    repository: createFreshInventoryPolicyRepository({ withTransaction, loadPolicies }) };
}
const identity = { provider: 'ollama', model: 'embedding:latest', digest: 'b'.repeat(64), dimensions: 2 };
const privateLogging = { level: 'fatal', fileLoggingEnabled: false };

test.each([{ level: 'info', fileLoggingEnabled: false }, { level: 'fatal', fileLoggingEnabled: true }])(
  'refuses private content access when startup logging is unsafe: %j', async logging => {
    const constructor = jest.spyOn(pg, 'Pool');
    try {
      await expect(loadFreshInventoryPolicyRuntime({ logging })).rejects.toThrow('private_logging_required');
      expect(constructor).not.toHaveBeenCalled();
    } finally { constructor.mockRestore(); }
  });

test('one read-only transaction owns policy, config, inventory and vector readers', async () => {
  const { repository, client, withTransaction, loadPolicies } = setup();
  const snapshot = await repository.read(identity);
  expect(withTransaction).toHaveBeenCalledTimes(1);
  expect(loadPolicies).toHaveBeenCalledWith({ dbClient: { query: expect.any(Function) }, throwOnError: true });
  expect(client.query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  expect(client.query.mock.calls.every(([sql]) => /^(SET |\s*SELECT )/.test(sql))).toBe(true);
  const sql = client.query.mock.calls.find(([sql]) => sql.includes('FROM media_server_items msi'))[0];
  expect(sql).toContain('msi.title, msi.year');
  expect(sql).toContain("octet_length((msi.metadata->'inventory_tmdb')::text) <= 100000");
  expect(sql).not.toContain('history.metadata AS metadata');
  expect(client.query.mock.calls.some(([sql]) => sql.includes('SELECT id, name, media_type, is_active FROM libraries'))).toBe(true);
  expect(snapshot.libraries.every(library => library.is_active === true)).toBe(true);
  expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  for (const mutate of [value => value.config.configuration_revision = 2,
    value => value.policies[0].prompt_threshold = 61,
    value => value.evaluationRows[0].title = 'Different',
    value => value.vectors.set([...value.vectors.keys()][0], [0, 1])]) {
    const changed = structuredClone(snapshot); mutate(changed);
    expect(fingerprintFreshPolicySnapshot(changed)).not.toBe(snapshot.fingerprint);
  }
});

test('unused refresh timestamps do not invalidate unchanged scoring inputs; metadata and authority changes do', () => {
  const { source } = freshFixture();
  const before = fingerprintFreshPolicySnapshot(source);
  source.evaluationRows[0].evaluation_metadata.inventory_tmdb.fetched_at = '2030-01-01';
  source.policies[0].policy_intent_authority_context = { observed_evidence_reference: { expires_at: '2030-01-01' } };
  expect(fingerprintFreshPolicySnapshot(source)).toBe(before);
  source.evaluationRows[0].evaluation_metadata.inventory_tmdb.keywords = ['changed'];
  expect(fingerprintFreshPolicySnapshot(source)).not.toBe(before);
  const metadataChanged = fingerprintFreshPolicySnapshot(source);
  source.policies[0].policy_runtime_authority = { validationOk: false, sourceId: 'native_intent' };
  expect(fingerprintFreshPolicySnapshot(source)).not.toBe(metadataChanged);
});

test('parallel production readers are serialized on the transaction client', async () => {
  const { client, repository, loadPolicies } = setup();
  let active = 0, maximum = 0;
  const original = client.query.getMockImplementation();
  client.query.mockImplementation(async (...args) => {
    maximum = Math.max(maximum, ++active);
    await Promise.resolve();
    try { return await original(...args); } finally { active--; }
  });
  loadPolicies.mockImplementation(async ({ dbClient }) => { await Promise.all([
    dbClient.query('SELECT 1'), dbClient.query('SELECT 2'), dbClient.query('SELECT 3'),
  ]); return []; });
  await repository.read(identity);
  expect(maximum).toBe(1);
});

test.each(['policies', 'policy_bytes', 'metadata_bytes', 'missing_config', 'read_failure'])('fails closed on %s', async kind => {
  const { source, repository, loadPolicies } = setup();
  if (kind === 'policies') source.policies = Array.from({ length: 65 }, () => ({}));
  if (kind === 'policy_bytes') source.policies[0].name = 'x'.repeat(2_000_001);
  if (kind === 'metadata_bytes') source.evaluationRows[0].title = 'x'.repeat(110_001);
  if (kind === 'missing_config') source.config = null;
  if (kind === 'read_failure') loadPolicies.mockRejectedValue(new Error('read_failed'));
  await expect(repository.read(identity)).rejects.toThrow(kind === 'read_failure' ? 'read_failed' : 'snapshot_budget');
});

test.each(['success', 'rollback', 'initialization_failure'])('dedicated runtime enforces read-only defaults and cleanup on %s', async kind => {
  const { source, client } = setup();
  client.release = jest.fn();
  const pool = { query: jest.fn(async () => ({ rows: [source.config] })), connect: jest.fn(async () => client), end: jest.fn() };
  const constructor = jest.spyOn(pg, 'Pool').mockImplementation(function () { return pool; });
  const globalEnd = jest.spyOn(db.pool, 'end').mockResolvedValue();
  try {
    if (kind === 'initialization_failure') pool.query.mockRejectedValue(new Error('initialization_failed'));
    if (kind === 'initialization_failure') await expect(loadFreshInventoryPolicyRuntime({ logging: privateLogging })).rejects.toThrow('initialization_failed');
    else {
      const runtime = await loadFreshInventoryPolicyRuntime({ logging: privateLogging });
      expect(runtime.createClient()).toHaveProperty('generate');
      if (kind === 'rollback') client.query.mockImplementation(async sql => {
        if (sql.startsWith('SET')) throw new Error('snapshot_failed');
        return { rows: [] };
      });
      if (kind === 'rollback') await expect(runtime.repository.read(identity)).rejects.toThrow('snapshot_failed');
      else expect((await runtime.repository.read(identity)).corpus.documents).toHaveLength(120);
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(kind === 'rollback' ? 'ROLLBACK' : 'COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
      await runtime.close();
    }
    expect(constructor.mock.calls[0][0].options).toContain('default_transaction_read_only=on');
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(globalEnd).toHaveBeenCalledTimes(1);
  } finally {
    constructor.mockRestore(); globalEnd.mockRestore();
  }
});
