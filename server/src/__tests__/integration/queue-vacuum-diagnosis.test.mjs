/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { readQueueVacuumDiagnosis } from '../../services/queueVacuumDiagnosis.mjs';
import { runQueueVacuumMaintenance } from '../../services/queueVacuumMaintenance.mjs';
import { queueVacuumRow } from '../helpers/queueVacuumFixture.mjs';
import { prepareQueueVacuumRecovery } from '../../services/queueVacuumRecoveryRepository.mjs';

async function diagnose(client, category = 'attempt_limit') {
  return readQueueVacuumDiagnosis(async (sql, params, timeout) => {
    await client.query("SELECT set_config('statement_timeout', $1, false)", [`${timeout}ms`]);
    return client.query(sql, params);
  }, category);
}

test('catalog diagnosis runs in a read-only transaction and contains only fixed aggregate fields', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await diagnose(client);
    expect(result).toMatchObject({ status: 'observed', activityVisibility: 'full', reason: 'no_blocker_observed' });
    expect(Object.values(result.evidence).every(Number.isSafeInteger)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"(?:pid|query|datname|usename|slot_name|application_name)"/);
    expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
    await client.query('COMMIT');
  } finally { client.release(true); }
});

test('real queue lock yields a possible-interference action without terminating its owner', async () => {
  const owner = await getPool().connect(), observer = await getPool().connect();
  try {
    await owner.query('BEGIN');
    await owner.query('LOCK TABLE task_queue IN SHARE UPDATE EXCLUSIVE MODE');
    const result = await diagnose(observer);
    expect(result.reason).toBe('lock_interference');
    expect(result.evidence.conflicting_locks).toBeGreaterThanOrEqual(1);
    expect((await owner.query('SELECT 1 AS alive')).rows[0].alive).toBe(1);
    await owner.query('ROLLBACK');
    expect((await diagnose(observer)).evidence.conflicting_locks).toBe(0);
  } finally { owner.release(true); observer.release(true); }
});

test('current-database live horizon is counted, not mislabeled as an hour-old blocker', async () => {
  const owner = await getPool().connect(), observer = await getPool().connect();
  try {
    await owner.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await owner.query('SELECT count(*) FROM task_queue');
    const result = await diagnose(observer);
    expect(result.evidence.retaining_transactions).toBeGreaterThanOrEqual(1);
    expect(result.evidence.old_transactions).toBe(0);
    expect(result.reason).toBe('no_blocker_observed');
    await owner.query('ROLLBACK');
  } finally { owner.release(true); observer.release(true); }
});

test('restricted observer cannot treat redacted activity as proof of no blockers or elevate itself', async () => {
  const role = `queue_diagnosis_${randomUUID().replaceAll('-', '')}`;
  const client = await getPool().connect();
  try {
    await client.query(`CREATE ROLE ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`SET ROLE ${role}`);
    expect(await diagnose(client)).toMatchObject({ status: 'observed', reason: 'visibility_limited', activityVisibility: 'limited' });
    expect((await client.query("SELECT pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') AS allowed")).rows[0].allowed).toBe(false);
  } finally {
    await client.query('RESET ROLE');
    await client.query(`DROP OWNED BY ${role}`);
    await client.query(`DROP ROLE ${role}`);
    client.release(true);
  }
});

test('disabled tracking remains explicitly incomplete', async () => {
  const client = await getPool().connect();
  try {
    await client.query('SET track_activities = off');
    expect(await diagnose(client)).toMatchObject({ reason: 'visibility_limited', activityVisibility: 'limited' });
  } finally { client.release(true); }
});

test('interrupted-attempt diagnostic admission is consumed durably without resetting cooldown or attempts', async () => {
  const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock(2027)');
    await client.query(`INSERT INTO queue_vacuum_recovery_state (singleton) VALUES (true) ON CONFLICT DO NOTHING`);
    await client.query(`UPDATE queue_vacuum_recovery_state SET attempts = 1, last_result = 'running',
      statistics_epoch = '123:initial', next_attempt_at = clock_timestamp() + INTERVAL '6 hours'`);
    const query = (sql, params) => client.query(sql, params);
    expect(await prepareQueueVacuumRecovery(query, queueVacuumRow({ sampled_at: new Date() })))
      .toMatchObject({ reason: 'cooldown', diagnosisTrigger: 'interrupted' });
    expect(await prepareQueueVacuumRecovery(query, queueVacuumRow({ sampled_at: new Date() })))
      .toMatchObject({ reason: 'cooldown', diagnosisTrigger: null });
    expect((await client.query('SELECT attempts, next_attempt_at > clock_timestamp() AS cooling FROM queue_vacuum_recovery_state')).rows[0])
      .toEqual({ attempts: 1, cooling: true });
  } finally { client.release(true); }
});

test('healthy automatic run never attaches a diagnostic and preserves queue content', async () => {
  const before = (await getPool().query('SELECT count(*) FROM task_queue')).rows;
  const result = await runQueueVacuumMaintenance({ database: { pool: getPool() }, automatic: true });
  expect(result.status).toBe('idle');
  expect(result).not.toHaveProperty('diagnosis');
  expect((await getPool().query('SELECT count(*) FROM task_queue')).rows).toEqual(before);
});
