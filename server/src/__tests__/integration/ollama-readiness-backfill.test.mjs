/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createOllamaReadinessBackfill } from '../../services/ollamaReadinessBackfill.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { loadOllamaVerificationCapabilityConfiguration, persistOllamaVerificationCapabilityProbe } from '../../services/ollamaVerificationCapabilityRepository.mjs';
import { resolveOllamaVerificationCapabilityIdentity } from '../../services/ollamaVerificationCapabilityIdentity.mjs';

const db = createIntegrationDatabaseModuleMock();
// Match the production helper's boolean acquisition contract, using real PG locks.
db.withSessionAdvisoryLock = async (key, work) => {
  const owner = await getPool().connect();
  try {
    if (!(await owner.query('SELECT pg_try_advisory_lock($1) AS acquired', [key])).rows[0].acquired) return false;
    try { await work({ signal: new AbortController().signal }); return true; }
    finally { await owner.query('SELECT pg_advisory_unlock($1)', [key]); }
  } finally { owner.release(); }
};
let libraryId;
beforeEach(async () => {
  await db.query(`UPDATE ai_provider_config SET primary_provider='ollama',ollama_host='fixture-only',
    ollama_model='fixture-model',rag_enabled=false,configuration_revision=configuration_revision+1,
    ollama_verification_capability_checked_at=NULL,ollama_verification_capability_status='not_checked',
    ollama_verification_capability_fingerprint=NULL,ollama_verification_capability_model_digest=NULL,
    ollama_verification_capability_configuration_revision=NULL WHERE id=1`);
  libraryId = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Synthetic readiness',$1,'movie',true) RETURNING id`, [randomUUID()])).rows[0].id;
  await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type)
    VALUES ($1,$2,'Synthetic readiness item','movie')`, [libraryId, randomUUID()]);
});
afterEach(async () => { await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]); });
function make(extra = {}) {
  const client = { preflightConnection: jest.fn(async () => ({ success: true,
    models: [{ name: 'fixture-model', digest: 'a'.repeat(64) }] })),
  generate: jest.fn(async () => '{"status":"ready","contract":"candidate-bound-verification"}') };
  const options = { database: db, admission: { tryAcquire: () => ({ allowed: true, release() {} }) },
    createClient: () => client, history: jest.fn(), ...extra };
  return { worker: createOllamaReadinessBackfill(options), client, options };
}

test('legacy missing evidence backfills with RAG disabled; recreated worker does not repeat inference', async () => {
  expect(await readInventoryBackgroundReadiness(db)).toBe('disabled');
  const f = make(); expect(await f.worker.run()).toEqual({ status: 'completed', readiness: 'verification_ready' });
  const stored = await loadOllamaVerificationCapabilityConfiguration(db);
  expect(stored.ollama_verification_capability_model_digest).toBe('a'.repeat(64));
  expect(stored.ollama_verification_capability_checked_at).toBeInstanceOf(Date);
  expect((await createOllamaReadinessBackfill(f.options).run()).reason).toBe('already_checked');
  expect(f.client.generate).toHaveBeenCalledTimes(1);
});

test('fresh/no inventory, active ingestion and incomplete handoff wait, then resume organically', async () => {
  const f = make();
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect((await f.worker.run()).reason).toBe('waiting_for_libraries');
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  expect((await f.worker.run()).reason).toBe('waiting_for_inventory');
  await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type)
    VALUES ($1,$2,'Synthetic readiness item','movie')`, [libraryId, randomUUID()]);
  await db.query("INSERT INTO library_ingestion_state(library_id,run_id,phase) VALUES ($1,$2,'running')", [libraryId, randomUUID()]);
  expect((await f.worker.run()).reason).toBe('ingesting');
  await db.query("UPDATE library_ingestion_state SET phase='complete' WHERE library_id=$1", [libraryId]);
  expect((await f.worker.run()).reason).toBe('backfilling');
  expect(f.client.generate).not.toHaveBeenCalled();
  await db.query('UPDATE library_ingestion_state SET backfill_run_id=run_id,backfill_completed_at=now() WHERE library_id=$1', [libraryId]);
  expect((await f.worker.run()).status).toBe('completed');
});

test('two automatic workers cannot infer concurrently; a manual verdict during I/O wins', async () => {
  let finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const f = make();
  f.client.generate.mockImplementation(() => { entered(); return new Promise(resolve => { finish = resolve; }); });
  const running = f.worker.run(); await started;
  try {
    expect((await make().worker.run()).reason).toBe('busy');
    const identity = resolveOllamaVerificationCapabilityIdentity(await loadOllamaVerificationCapabilityConfiguration(db));
    await db.withTransaction(client => persistOllamaVerificationCapabilityProbe({ client, identity, outcome: {
      statusId: 'classification_only', configurationFingerprint: identity.fingerprint,
      configurationRevision: identity.configurationRevision, modelDigest: null,
      checkedAt: new Date().toISOString(), errorCode: 'structured_response_invalid', latencyMs: 1,
    } }));
  } finally { finish('{"status":"ready","contract":"candidate-bound-verification"}'); }
  expect((await running).reason).toBe('already_checked');
  expect((await loadOllamaVerificationCapabilityConfiguration(db)).ollama_verification_capability_status).toBe('classification_only');
  expect(f.options.history).not.toHaveBeenCalled();
});

test('settings replacement while probing rejects stale evidence and leaves missing work discoverable', async () => {
  const f = make();
  f.client.generate.mockImplementationOnce(async () => {
    await db.query('UPDATE ai_provider_config SET configuration_revision=configuration_revision+1 WHERE id=1');
    return '{"status":"ready","contract":"candidate-bound-verification"}';
  });
  expect((await f.worker.run()).reason).toBe('configuration_changed');
  expect((await loadOllamaVerificationCapabilityConfiguration(db)).ollama_verification_capability_checked_at).toBeNull();
  expect((await make().worker.run()).status).toBe('completed');
});

test('failed model check is stored as unavailable, not readiness or an endless automatic retry', async () => {
  const f = make(); f.client.preflightConnection.mockResolvedValue({ success: false, failureType: 'connection_failed' });
  expect((await f.worker.run()).readiness).toBe('unavailable');
  const saved = await loadOllamaVerificationCapabilityConfiguration(db);
  expect(saved.ollama_verification_capability_model_digest).toBeNull();
  expect((await make().worker.run()).reason).toBe('already_checked');
});

test.each(['shutdown', 'write_failure'])('a %s before commit rolls back capability evidence for the next worker', async mode => {
  const f = make({ persist: async args => {
    const saved = await persistOllamaVerificationCapabilityProbe(args);
    if (mode === 'write_failure') throw new Error('synthetic_write_failure');
    f.worker.stop();
    return saved;
  } });
  expect((await f.worker.run()).status).toBe(mode === 'shutdown' ? 'stopped' : 'failed');
  expect((await loadOllamaVerificationCapabilityConfiguration(db)).ollama_verification_capability_checked_at).toBeNull();
  expect((await make().worker.run()).status).toBe('completed');
});
