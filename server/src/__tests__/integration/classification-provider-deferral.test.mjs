/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { ClassificationProviderCircuitRepository } = await import('../../services/classificationProviderCircuitRepository.mjs');
const { ClassificationProviderAdmissionService } = await import('../../services/classificationProviderAdmissionService.mjs');
const { AutomaticClassificationRecoveryRepository } = await import('../../services/automaticClassificationRecoveryRepository.mjs');
const { AutomaticClassificationRecoveryService } = await import('../../services/automaticClassificationRecoveryService.mjs');
const { automaticClassificationRecoveryService } = await import('../../services/automaticClassificationRecoveryService.mjs');
const { classificationProviderAdmissionService } = await import('../../services/classificationProviderAdmissionService.mjs');
const { processRetryQueue } = await import('../../services/schedulerOperationalTasks.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { buildPendingRetryResult } = await import('../../services/classificationAiFailureUtils.mjs');
const { buildClassificationDependencyKey, isProviderDeferredError } = await import('../../services/classificationProviderDeferralPolicy.mjs');
const { classificationPendingDecisionLifecycleService } = await import('../../services/classificationPendingDecisionLifecycleService.mjs');

const provider = { type: 'custom', isCloud: true, config: { model: 'synthetic', api_endpoint: 'https://example.invalid' } };
let pool, circuits, recoveryRepository, admission, recovery, readiness, snapshot, key, retryService;
beforeAll(() => { pool = getPool(); });
beforeEach(async () => {
  jest.restoreAllMocks();
  await pool.query('TRUNCATE task_queue, classification_history, classification_provider_circuits, classification_recovery_probe_state RESTART IDENTITY CASCADE');
  await pool.query(`UPDATE ai_provider_config SET configuration_revision = 1, primary_provider = 'custom',
    model = 'synthetic', api_endpoint = 'https://example.invalid' WHERE id = 1`);
  const logger = createMockLogger();
  circuits = new ClassificationProviderCircuitRepository({ database: db });
  recoveryRepository = new AutomaticClassificationRecoveryRepository({ database: db });
  admission = new ClassificationProviderAdmissionService({ repository: circuits, configuration: recoveryRepository, logger });
  snapshot = await recoveryRepository.loadConfiguration();
  key = buildClassificationDependencyKey(snapshot, provider);
  readiness = { probe: jest.fn(async (current) => ({ fingerprint: current.fingerprint, checkedAt: Date.now(),
    dependencyKey: buildClassificationDependencyKey(current, provider) })) };
  retryService = new ClassificationRetryService({ db, logger });
  recovery = new AutomaticClassificationRecoveryService({ repository: recoveryRepository, readiness, retryService, logger });
  jest.spyOn(automaticClassificationRecoveryService, 'run').mockImplementation(() => recovery.run());
  jest.spyOn(classificationProviderAdmissionService, 'getCurrentDependencyKey').mockImplementation(async () => key);
});
afterEach(() => jest.restoreAllMocks());

async function seedPending(tmdb = 991001, mediaType = 'movie', count = 1, code = 'ai_provider_deferred') {
  return (await pool.query(`INSERT INTO classification_history
    (tmdb_id, media_type, title, method, status, retry_count, max_retries, retry_failure_code, retry_after,
     retry_recovery_attempts, metadata, pending_identity_key)
    VALUES ($1::integer, $2::text, 'Synthetic deferred item ' || $1::integer::text, 'queued_for_retry', 'pending_retry', $3, 3,
      $4, NOW() - interval '1 minute', 1, $5::jsonb, 'tmdb:' || $2::text || ':' || $1::integer::text) RETURNING id`,
  [tmdb, mediaType, count, code, JSON.stringify({ tmdb_id: tmdb, media_type: mediaType })])).rows[0].id;
}
async function trip() {
  const ticket = await admission.admit(snapshot.config, provider);
  expect(await admission.failed(ticket, { code: 'ECONNREFUSED' })).toBe(true);
  return ticket;
}
async function due() { await pool.query("UPDATE classification_recovery_probe_state SET next_probe_at = NOW() - interval '1 second'"); }

test.each(['movie', 'tv'])('holds %s work across restart without spending item or recovery budgets', async mediaType => {
  await trip();
  const id = await seedPending(991001, mediaType);
  const restarted = new ClassificationProviderAdmissionService({ repository: new ClassificationProviderCircuitRepository({ database: db }),
    configuration: recoveryRepository, logger: createMockLogger() });
  let deferred;
  try { await restarted.admit(snapshot.config, provider); } catch (error) { deferred = error; }
  expect(isProviderDeferredError(deferred)).toBe(true);
  expect(buildPendingRetryResult({ transientError: deferred, previousRetryCount: 2 }).retry_count).toBe(2);
  expect((await recovery.run()).state).toBe('cooldown');
  expect(readiness.probe).not.toHaveBeenCalled();
  expect((await pool.query('SELECT status, retry_count, retry_recovery_attempts FROM classification_history WHERE id = $1', [id])).rows[0])
    .toEqual({ status: 'pending_retry', retry_count: 1, retry_recovery_attempts: 1 });
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('one probe resumes five pending jobs without renewing their budgets; actual generation closes the circuit', async () => {
  await trip();
  for (let i = 0; i < 7; i++) await seedPending(992000 + i, i % 2 ? 'tv' : 'movie');
  await due();
  const restarted = new AutomaticClassificationRecoveryService({ repository: recoveryRepository, readiness, retryService, logger: createMockLogger() });
  const passes = await Promise.all([recovery.run(), restarted.run()]);
  expect(passes.reduce((n, pass) => n + pass.queued, 0)).toBe(5);
  expect(readiness.probe).toHaveBeenCalledTimes(1);
  const tasks = (await pool.query("SELECT * FROM task_queue WHERE task_type = 'classification'")).rows;
  expect(tasks).toHaveLength(5);
  for (const task of tasks) {
    expect(task.source).toBe('retry_queue');
    expect(task.classification_recovery_attempts).toBe(1);
    expect(task.payload.retry_count).toBe(1);
  }
  const tickets = await Promise.all(Array.from({ length: 10 }, () => circuits.admit(key)));
  expect(tickets.filter(Boolean)).toHaveLength(5);
  await admission.succeeded(tickets.find(Boolean));
  expect((await pool.query('SELECT state FROM classification_provider_circuits')).rows[0].state).toBe('closed');
  expect((await circuits.admit(key)).key).toBe(key);
});

test('failed probes leave jobs waiting and do not consume any item attempt', async () => {
  await trip();
  await seedPending();
  await due();
  readiness.probe.mockResolvedValue(null);
  expect(await recovery.run()).toEqual({ state: 'unavailable', queued: 0 });
  expect((await pool.query('SELECT retry_count FROM classification_history')).rows[0].retry_count).toBe(1);
  expect(await circuits.admit(key)).toBeNull();
});

test('queue delay does not spend the trial window before the first worker admission', async () => {
  await trip();
  await seedPending();
  await due();
  expect(await recovery.run()).toEqual({ state: 'ready', queued: 1 });
  // Advance only persisted deadlines in the disposable database, not wall time.
  // Subtracting from NULL preserves an unstarted window. The old enqueue-time
  // deadline instead expires here, reproducing a queue delay longer than 60s.
  await pool.query(`UPDATE classification_provider_circuits
    SET updated_at = updated_at - interval '2 minutes', ready_until = ready_until - interval '2 minutes'`);
  const restarted = new ClassificationProviderCircuitRepository({ database: db });
  const ticket = await restarted.admit(key);
  expect(ticket).not.toBeNull();
  const first = (await pool.query(`SELECT ready_until, trial_remaining,
    ready_until > clock_timestamp() AS active,
    ready_until <= clock_timestamp() + interval '60 seconds' AS bounded
    FROM classification_provider_circuits`)).rows[0];
  expect(first).toMatchObject({ active: true, bounded: true, trial_remaining: 4 });
  expect(await restarted.admit(key)).toEqual(ticket);
  expect((await pool.query('SELECT ready_until FROM classification_provider_circuits')).rows[0].ready_until)
    .toEqual(first.ready_until);
});

test.each(['movie', 'tv'])('expired active trial persists %s work and resumes it without renewing budgets', async mediaType => {
  await trip();
  const originalId = await seedPending(994002, mediaType, 2);
  await due();
  expect(await recovery.run()).toEqual({ state: 'ready', queued: 1 });
  const task = (await pool.query("SELECT * FROM task_queue WHERE task_type = 'classification'")).rows[0];
  expect(task.payload.retry_count).toBe(2);
  expect(task.classification_recovery_attempts).toBe(1);
  expect(await circuits.admit(key)).not.toBeNull();
  await pool.query("UPDATE classification_provider_circuits SET ready_until = clock_timestamp() - interval '1 second'");
  let deferred;
  try { await admission.admit(snapshot.config, provider); } catch (error) { deferred = error; }
  expect(isProviderDeferredError(deferred)).toBe(true);
  const result = buildPendingRetryResult({ transientError: deferred,
    previousRetryCount: task.payload.retry_count, maxRetries: task.payload.max_retries });
  const persistence = new ClassificationPersistenceService();
  const replacementId = await persistence.logClassification(task.payload, result, null, { queueTask: task });
  await persistence.rebindRetryLineage(replacementId, task.payload);
  // Complete the simulated worker only after its replacement decision is durable.
  await pool.query("UPDATE task_queue SET status = 'completed' WHERE id = $1", [task.id]);
  const pending = (await pool.query(`SELECT status, retry_count, max_retries, retry_recovery_attempts,
    pending_identity_key, retry_failure_code, library_id, retry_after > clock_timestamp() AS scheduled
    FROM classification_history WHERE id = $1`, [replacementId])).rows[0];
  expect(pending).toEqual({ status: 'pending_retry', retry_count: 2, max_retries: 3,
    retry_recovery_attempts: 1, pending_identity_key: `tmdb:${mediaType}:994002`,
    retry_failure_code: 'ai_provider_deferred', library_id: null, scheduled: true });
  expect((await pool.query('SELECT status FROM classification_history WHERE id = $1', [originalId])).rows[0].status)
    .toBe('reclassified');
  await pool.query("UPDATE classification_history SET retry_after = NOW() - interval '1 second' WHERE id = $1", [replacementId]);
  await due();
  const restarted = new AutomaticClassificationRecoveryService({ repository: recoveryRepository, readiness,
    retryService: new ClassificationRetryService({ db, logger: createMockLogger() }), logger: createMockLogger() });
  expect(await restarted.run()).toEqual({ state: 'ready', queued: 1 });
  expect(await recovery.run()).toEqual({ state: 'idle', queued: 0 });
  const resumed = (await pool.query("SELECT * FROM task_queue WHERE task_type = 'classification' AND status = 'pending'")).rows;
  expect(resumed).toHaveLength(1);
  expect(resumed[0].payload).toMatchObject({ tmdb_id: 994002, media_type: mediaType, retry_count: 2, max_retries: 3 });
  expect(resumed[0].classification_recovery_attempts).toBe(1);
  const ticket = await circuits.admit(key);
  expect(ticket).not.toBeNull();
  expect(await circuits.close(ticket)).toBe(true);
  expect(readiness.probe).toHaveBeenCalledTimes(2);
});

test('a rescheduled pending item is rechecked after probing before opening a trial or queueing work', async () => {
  await trip();
  const id = await seedPending();
  await due();
  readiness.probe.mockImplementation(async current => {
    await pool.query("UPDATE classification_history SET retry_after = NOW() + interval '1 hour' WHERE id = $1", [id]);
    return { fingerprint: current.fingerprint, checkedAt: Date.now(), dependencyKey: key };
  });
  expect(await recovery.run()).toEqual({ state: 'ready', queued: 0 });
  expect((await pool.query('SELECT state FROM classification_provider_circuits')).rows[0].state).toBe('open');
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('scheduler holds the outage, releases five trials, then restores normal backlog throughput', async () => {
  await trip();
  for (let i = 0; i < 9; i++) await seedPending(993000 + i);
  await processRetryQueue();
  expect((await pool.query("SELECT id FROM task_queue WHERE task_type = 'classification'")).rows).toHaveLength(0);
  await due();
  await processRetryQueue();
  expect((await pool.query("SELECT id FROM task_queue WHERE task_type = 'classification'")).rows).toHaveLength(5);
  await admission.succeeded(await circuits.admit(key));
  await processRetryQueue();
  expect((await pool.query("SELECT id FROM task_queue WHERE task_type = 'classification'")).rows).toHaveLength(9);
  expect(readiness.probe).toHaveBeenCalledTimes(1);
});

test('a different current provider and item-specific errors are not held by another circuit', async () => {
  await trip();
  await seedPending(993001, 'tv', 1, 'ai_stream_incomplete');
  await processRetryQueue();
  expect((await pool.query("SELECT id FROM task_queue WHERE task_type = 'classification'")).rows).toHaveLength(1);
  await seedPending(993002);
  classificationProviderAdmissionService.getCurrentDependencyKey.mockResolvedValue('b'.repeat(64));
  await processRetryQueue();
  expect((await pool.query("SELECT id FROM task_queue WHERE task_type = 'classification'")).rows).toHaveLength(2);
});

test('stale in-flight success/failure and repeated proof cannot overwrite a new outage or replenish trials', async () => {
  const old = await trip();
  const lease = randomUUID();
  await circuits.grantTrial(pool, key, lease);
  const first = await circuits.admit(key);
  const second = await circuits.admit(key);
  await circuits.grantTrial(pool, key, lease);
  expect((await pool.query('SELECT trial_remaining FROM classification_provider_circuits')).rows[0].trial_remaining).toBe(3);
  expect(await circuits.open(first, 'ai_timeout')).toBe(true);
  expect(await circuits.close(second)).toBe(false);
  expect(await circuits.open(old, 'ai_timeout')).toBe(false);
  expect(await circuits.admit(key)).toBeNull();
  expect((await pool.query('SELECT lease_token FROM classification_recovery_probe_state')).rows[0].lease_token).toBeNull();
});

test('new configuration/model does not inherit the old outage, and expired trial proof holds work', async () => {
  await trip();
  expect(await circuits.admit(buildClassificationDependencyKey(snapshot, { ...provider, config: { model: 'different' } }))).not.toBeNull();
  await pool.query('UPDATE ai_provider_config SET configuration_revision = 2 WHERE id = 1');
  expect(await admission.admit({ ...snapshot.config, configuration_revision: 2 }, provider)).not.toBeNull();
  await circuits.grantTrial(pool, key, randomUUID());
  await pool.query("UPDATE classification_provider_circuits SET ready_until = NOW() - interval '1 second'");
  expect(await circuits.admit(key)).toBeNull();
});

test('a failed transaction rolls trial admission back together with the retry task', async () => {
  await trip();
  const id = await seedPending();
  await due();
  const lease = await recoveryRepository.claimProbe();
  const proof = await readiness.probe(snapshot);
  const result = await retryService.retrySingle({ classificationId: id, taskSource: 'retry_queue',
    retryEligibilityCheck: ({ client, classification }) => recoveryRepository.checkReadiness(client, proof, lease, classification),
    retryReceiptRecorder: async () => { throw new Error('synthetic rollback'); } });
  expect(result.failed).toBe(true);
  expect((await pool.query('SELECT state FROM classification_provider_circuits')).rows[0].state).toBe('open');
  expect((await pool.query('SELECT id FROM task_queue')).rows).toHaveLength(0);
});

test('deferred replacement history persists unchanged counters and remains automatically retryable', async () => {
  await trip();
  let error;
  try { await admission.admit(snapshot.config, provider); } catch (deferred) { error = deferred; }
  const result = buildPendingRetryResult({ transientError: error, previousRetryCount: 2, maxRetries: 3 });
  const persistence = new ClassificationPersistenceService();
  const id = await persistence.logClassification({ tmdb_id: 994001, media_type: 'movie', title: 'Synthetic pending result' }, result);
  const row = (await pool.query('SELECT retry_count, retry_failure_code, status FROM classification_history WHERE id = $1', [id])).rows[0];
  expect(row).toEqual({ retry_count: 2, retry_failure_code: 'ai_provider_deferred', status: 'pending_retry' });
});

test.each(['2030-01-01T03:00:00-04:00', '2030-01-01T16:00:00+09:00', null])(
  'retry persistence preserves the instant of an offset-bearing deadline (%s)', async retryAfter => {
    const persistence = new ClassificationPersistenceService();
    const result = { ...buildPendingRetryResult({}), retry_after: retryAfter };
    const id = await persistence.logClassification({ tmdb_id: 994003, media_type: 'tv', title: 'Synthetic timezone case' }, result);
    const row = (await pool.query(`SELECT retry_after AT TIME ZONE current_setting('TimeZone') AS instant
      FROM classification_history WHERE id = $1`, [id])).rows[0];
    expect(row.instant).toEqual(retryAfter === null ? null : new Date('2030-01-01T07:00:00Z'));
  },
);

test('pending replacement and recovery use the same identity-first lock order', async () => {
  await trip();
  const id = await seedPending();
  await due();
  const lease = await recoveryRepository.claimProbe();
  const proof = await readiness.probe(snapshot);
  let entered;
  const acquired = new Promise(resolve => { entered = resolve; });
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const replacement = classificationPendingDecisionLifecycleService.persist({ status: 'pending_retry',
    identity: { key: 'tmdb:movie:991001', version: 'test' },
    insert: async client => { entered(); await barrier;
      return (await client.query(`INSERT INTO classification_history
        (tmdb_id, media_type, title, method, status, pending_identity_key)
        VALUES (991001, 'movie', 'Synthetic replacement', 'queued_for_retry', 'pending_retry', 'tmdb:movie:991001') RETURNING id`)).rows[0].id;
    } });
  await acquired;
  const retry = retryService.retrySingle({ classificationId: id, taskSource: 'retry_queue',
    retryEligibilityCheck: ({ client, classification }) => recoveryRepository.checkReadiness(client, proof, lease, classification) });
  release();
  await replacement;
  expect(await retry).toMatchObject({ queued: false, skipped: true, reasonCode: 'status_ineligible' });
});
