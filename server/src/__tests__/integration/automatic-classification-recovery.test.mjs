/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { AutomaticClassificationRecoveryRepository } = await import('../../services/automaticClassificationRecoveryRepository.mjs');
const { AutomaticClassificationRecoveryService } = await import('../../services/automaticClassificationRecoveryService.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { deadLetterExhaustedRetries } = await import('../../services/schedulerOperationalTasks.mjs');
const { buildPendingRetryResult } = await import('../../services/classificationAiFailureUtils.mjs');
const { queueService } = await import('../../services/queueService.mjs');

let pool, repository, readiness, retryService, service, logger;
beforeAll(() => { pool = getPool(); });
beforeEach(async () => {
  await pool.query('TRUNCATE task_queue, classification_history, libraries, media_server_items RESTART IDENTITY CASCADE');
  await pool.query(`INSERT INTO classification_recovery_probe_state (id) VALUES (true)
    ON CONFLICT (id) DO UPDATE SET next_probe_at = NOW(), lease_token = NULL,
      checked_at = NULL, last_outcome = NULL`);
  await pool.query(`INSERT INTO ai_provider_config (id, primary_provider) VALUES (1, 'none')
    ON CONFLICT (id) DO UPDATE SET primary_provider = 'none'`);
  logger = createMockLogger();
  repository = new AutomaticClassificationRecoveryRepository({ database: db });
  readiness = { probe: jest.fn(async (snapshot) => ({ fingerprint: snapshot.fingerprint, checkedAt: Date.now() })) };
  retryService = new ClassificationRetryService({ db, logger });
  service = new AutomaticClassificationRecoveryService({ repository, readiness, retryService, logger });
});

async function seed({ tmdb = 990001, mediaType = 'movie', code = 'ai_timeout', count = 0, age = '16 minutes' } = {}) {
  const result = await pool.query(`INSERT INTO classification_history
    (tmdb_id, media_type, title, method, status, retry_count, max_retries, retry_failure_code,
     retry_recovery_attempts, retry_exhausted_at, metadata, pending_identity_key)
    VALUES ($1::integer, $2::text, 'Synthetic recovery item ' || $1::integer::text, 'queued_for_retry', 'failed', 3, 3, $3, $4,
      NOW() - $5::interval, $6::jsonb, 'tmdb:' || $2::text || ':' || $1::integer::text) RETURNING id`,
  [tmdb, mediaType, code, count, age, JSON.stringify({ tmdb_id: tmdb, media_type: mediaType })]);
  return result.rows[0].id;
}

async function complete(id) {
  const library = await pool.query(`INSERT INTO libraries (external_id, name, media_type)
    VALUES ('recovery-test', 'Synthetic library', 'movie') RETURNING id`);
  await pool.query("UPDATE classification_history SET status = 'completed', method = 'ai_analysis', library_id = $2 WHERE id = $1",
    [id, library.rows[0].id]);
}

test.each(['movie', 'tv'])('recovers exhausted %s work exactly once without routing', async (mediaType) => {
  const id = await seed({ mediaType });
  expect(await service.run()).toEqual({ state: 'ready', queued: 1 });
  const task = (await pool.query("SELECT * FROM task_queue WHERE task_type = 'classification'")).rows[0];
  expect(task).toMatchObject({ source: 'provider_recovery', classification_recovery_attempts: 1 });
  expect(task.payload).toMatchObject({ retry_count: 0, max_retries: 3, media_type: mediaType });
  expect(task.payload).not.toHaveProperty('retry_recovery_attempts');
  const history = (await pool.query('SELECT * FROM classification_history WHERE id = $1', [id])).rows[0];
  expect(history).toMatchObject({ status: 'reclassified', library_id: null, retry_recovery_attempts: 1 });
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
});

test('persisted cooldown survives a new service instance and prevents simultaneous probes', async () => {
  await seed();
  readiness.probe.mockResolvedValue(null);
  const restarted = new AutomaticClassificationRecoveryService({
    repository: new AutomaticClassificationRecoveryRepository({ database: db }), readiness, retryService, logger,
  });
  const results = await Promise.all([service.run(), restarted.run()]);
  expect(results.map((r) => r.state).sort()).toEqual(['cooldown', 'unavailable']);
  expect(readiness.probe).toHaveBeenCalledTimes(1);
  expect((await restarted.run()).state).toBe('cooldown');
  const state = (await pool.query(`SELECT EXTRACT(EPOCH FROM (next_probe_at - NOW())) AS seconds,
    last_outcome FROM classification_recovery_probe_state`)).rows[0];
  expect(Number(state.seconds)).toBeGreaterThan(895);
  expect(Number(state.seconds)).toBeLessThanOrEqual(960);
  expect(state.last_outcome).toBe('unavailable');
});

test('fresh snapshot installs initialize the singleton atomically on the first claim', async () => {
  await pool.query('DELETE FROM classification_recovery_probe_state');
  const other = new AutomaticClassificationRecoveryRepository({ database: db });
  const leases = await Promise.all([repository.claimProbe(), other.claimProbe()]);
  expect(leases.filter(Boolean)).toHaveLength(1);
  expect((await pool.query('SELECT id FROM classification_recovery_probe_state')).rows).toHaveLength(1);
});

test('generation failure does not consume a job recovery attempt', async () => {
  const id = await seed();
  readiness.probe.mockRejectedValue(new Error('synthetic outage'));
  expect((await service.run()).state).toBe('unavailable');
  expect((await pool.query('SELECT retry_recovery_attempts FROM classification_history WHERE id = $1', [id])).rows[0].retry_recovery_attempts).toBe(0);
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('cancelling the recovered queue job does not resurrect the exhausted history', async () => {
  await seed();
  expect((await service.run()).queued).toBe(1);
  const task = (await pool.query('SELECT id FROM task_queue')).rows[0];
  expect(await queueService.cancelTask(task.id)).toMatchObject({ success: true });
  expect((await service.run()).state).toBe('idle');
  expect(readiness.probe).toHaveBeenCalledTimes(1);
  expect((await pool.query('SELECT status FROM task_queue WHERE id = $1', [task.id])).rows[0].status).toBe('cancelled');
});

test.each([null, 'ai_provider_not_found', 'ai_stream_aborted', 'ai_temporarily_unavailable'])('does not probe or replay unknown/permanent cause %s', async (code) => {
  await seed({ code });
  expect((await service.run()).state).toBe('idle');
  expect(readiness.probe).not.toHaveBeenCalled();
});

test('job cooldown and per-chain cap survive an application restart', async () => {
  await seed({ age: '1 minute' });
  await seed({ tmdb: 990002, count: 1 });
  expect((await service.run()).state).toBe('idle');
});

test('limits each recovery batch to five jobs', async () => {
  for (let i = 0; i < 8; i += 1) await seed({ tmdb: 991000 + i });
  expect(await service.run()).toEqual({ state: 'ready', queued: 5 });
  expect((await service.run()).state).toBe('cooldown');
});

test('configuration changed during generation invalidates proof before any enqueue', async () => {
  await seed();
  readiness.probe.mockImplementation(async (snapshot) => {
    await pool.query('UPDATE ai_provider_config SET configuration_revision = configuration_revision + 1 WHERE id = 1');
    return { fingerprint: snapshot.fingerprint, checkedAt: Date.now() };
  });
  expect(await service.run()).toEqual({ state: 'configuration_changed', queued: 0 });
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('a newer completed decision excludes the old failure before probing', async () => {
  await seed();
  const latest = await seed();
  await complete(latest);
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  expect(readiness.probe).not.toHaveBeenCalled();
});

test('rechecks a newer decision created while the provider probe was in flight', async () => {
  await seed();
  readiness.probe.mockImplementation(async (snapshot) => {
    const latest = await seed();
    await complete(latest);
    return { fingerprint: snapshot.fingerprint, checkedAt: Date.now() };
  });
  expect(await service.run()).toEqual({ state: 'ready', queued: 0 });
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('transaction rollback preserves the job budget and removes an inserted task', async () => {
  const id = await seed();
  const lease = await repository.claimProbe();
  const proof = await readiness.probe(await repository.loadConfiguration());
  const result = await retryService.retrySingle({ classificationId: id, taskSource: 'provider_recovery',
    retryEligibilityCheck: ({ client, classification }) => repository.checkReadiness(client, proof, lease, classification),
    retryReceiptRecorder: async () => { throw new Error('synthetic receipt failure'); },
  });
  expect(result.failed).toBe(true);
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
  expect((await pool.query('SELECT status, retry_recovery_attempts FROM classification_history WHERE id = $1', [id])).rows[0])
    .toEqual({ status: 'failed', retry_recovery_attempts: 0 });
});

test('two independent retry services cannot consume the same recovery twice', async () => {
  const id = await seed();
  const lease = await repository.claimProbe();
  const proof = await readiness.probe(await repository.loadConfiguration());
  const options = { classificationId: id, taskSource: 'provider_recovery',
    retryEligibilityCheck: ({ client, classification }) => repository.checkReadiness(client, proof, lease, classification) };
  const other = new ClassificationRetryService({ db, logger });
  const results = await Promise.all([retryService.retrySingle(options), other.retrySingle(options)]);
  expect(results.filter((r) => r.queued)).toHaveLength(1);
  expect(results.filter((r) => r.skipped)).toHaveLength(1);
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(1);
});

test('internal recovery source alone cannot bypass readiness', async () => {
  const id = await seed();
  expect(await retryService.retrySingle({ classificationId: id, taskSource: 'provider_recovery' }))
    .toMatchObject({ skipped: true, reasonCode: 'recovery_readiness_required' });
});

test('replacement history inherits the database budget, not forged payload metadata; manual retry remains available', async () => {
  await seed();
  expect((await service.run()).queued).toBe(1);
  const task = (await pool.query('SELECT * FROM task_queue')).rows[0];
  await pool.query("UPDATE task_queue SET status = 'completed' WHERE id = $1", [task.id]);
  const persistence = new ClassificationPersistenceService();
  const metadata = { tmdb_id: 990001, media_type: 'movie', title: 'Synthetic recovery item',
    retry_recovery_attempts: 0, classification_recovery_attempts: 0 };
  const result = buildPendingRetryResult({ transientError: { code: 'ETIMEDOUT' }, previousRetryCount: 2, maxRetries: 3 });
  const replacementId = await persistence.logClassification(metadata, result, null, { queueTask: { id: task.id } });
  const replacement = (await pool.query('SELECT * FROM classification_history WHERE id = $1', [replacementId])).rows[0];
  expect(replacement).toMatchObject({ retry_recovery_attempts: 1, retry_failure_code: 'ai_timeout', retry_count: 3 });
  await deadLetterExhaustedRetries();
  await pool.query("UPDATE classification_history SET retry_exhausted_at = NOW() - interval '1 hour' WHERE id = $1", [replacementId]);
  expect((await service.run()).state).toBe('idle');
  expect((await retryService.retrySingle({ classificationId: replacementId, taskSource: 'manual_retry' })).queued).toBe(true);
  const manual = (await pool.query("SELECT * FROM task_queue WHERE source = 'manual_retry'")).rows[0];
  expect(manual.classification_recovery_attempts).toBe(0);
});

test('ordinary scheduled retries carry the consumed budget to their replacement task', async () => {
  const id = await seed({ count: 1 });
  await pool.query("UPDATE classification_history SET status = 'pending_retry', retry_count = 1, retry_after = NOW() WHERE id = $1", [id]);
  expect((await retryService.retrySingle({ classificationId: id, taskSource: 'retry_queue' })).queued).toBe(true);
  const task = (await pool.query('SELECT * FROM task_queue')).rows[0];
  expect(task.classification_recovery_attempts).toBe(1);
  expect(task.payload.retry_count).toBe(1);
});

test('recovery cannot inherit an oversized historical retry budget', async () => {
  const id = await seed();
  await pool.query('UPDATE classification_history SET retry_count = 100, max_retries = 100 WHERE id = $1', [id]);
  expect((await service.run()).queued).toBe(1);
  const task = (await pool.query('SELECT payload FROM task_queue')).rows[0];
  expect(task.payload.max_retries).toBe(3);
});

test('missing queue provenance fails closed instead of silently renewing the budget', async () => {
  const persistence = new ClassificationPersistenceService();
  const id = await persistence.logClassification({ tmdb_id: 994001, media_type: 'tv', title: 'Missing task' },
    buildPendingRetryResult({ transientError: { code: 'ETIMEDOUT' } }), null, { queueTask: { id: 999999 } });
  expect((await pool.query('SELECT retry_recovery_attempts FROM classification_history WHERE id = $1', [id])).rows[0].retry_recovery_attempts).toBe(1);
});
