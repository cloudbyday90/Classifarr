/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runDatabaseProfilingMaintenance } from '../../services/databaseProfilingMaintenance.mjs';
import { readDatabaseProfilingStatus } from '../../services/databaseProfilingStatus.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../../utils/backupRestoreSessionContract.mjs';

describe('real optional profiling maintenance, isolated preloaded PostgreSQL', () => {
  let container, pool, restricted;
  const maintain = () => runDatabaseProfilingMaintenance({ database: { pool } });
  const exists = async () => (await pool.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') AS installed")).rows[0].installed;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:0.8.7-pg18')
      .withPassword(randomUUID()).withResourcesQuota({ memory: 512 * 1024 * 1024, cpu: 1 })
      .withCommand(['postgres', '-c', 'shared_preload_libraries=pg_stat_statements']).start();
    pool = new pg.Pool({ connectionString: container.getConnectionUri(), max: 3, statement_timeout: 5000 });
    const password = randomUUID();
    await pool.query(`CREATE ROLE profiling_reader LOGIN PASSWORD '${password}'`);
    await pool.query('GRANT pg_read_all_settings TO profiling_reader');
    restricted = new pg.Pool({ host: container.getHost(), port: container.getPort(), database: container.getDatabase(),
      user: 'profiling_reader', password, max: 1, connectionTimeoutMillis: 5000 });
  });
  beforeEach(async () => {
    await pool.query('DROP EXTENSION IF EXISTS pg_stat_statements');
    await pool.query('DROP TABLE IF EXISTS public.policy_native_intent_reconciliation_restore_gates');
  });
  afterAll(async () => {
    try { await restricted?.end(); await pool?.end(); }
    finally { await container?.stop(); }
  });
  test('fresh DB installs once, survives a new session, and only observes thereafter', async () => {
    expect(await maintain()).toEqual({ status: 'installed' });
    expect(await exists()).toBe(true);
    expect(await maintain()).toEqual({ status: 'already_active' });
    expect(await readDatabaseProfilingStatus(pool)).toEqual({ active: true });
  });
  test.each(['pg_advisory_lock_shared', 'pg_advisory_lock'])('live %s holder prevents installation until release', async lock => {
    const holder = await pool.connect();
    try {
      await holder.query(`SELECT ${lock}($1)`, [RUNTIME_MAINTENANCE_LOCK_KEY]);
      expect(await maintain()).toEqual({ status: 'deferred', reason: 'runtime_or_restore_active' });
      expect(await exists()).toBe(false);
    } finally { holder.release(true); }
    expect(await maintain()).toEqual({ status: 'installed' });
  });
  test.each([null, 'blocked', 'restoring'])('present restore gate %s must not be bypassed', async state => {
    await pool.query('CREATE TABLE public.policy_native_intent_reconciliation_restore_gates(gate_id integer, gate_state text)');
    if (state) await pool.query('INSERT INTO public.policy_native_intent_reconciliation_restore_gates VALUES(1,$1)', [state]);
    expect(await maintain()).toEqual({ status: 'deferred', reason: 'restore_verification_required' });
    expect(await exists()).toBe(false);
    await pool.query('TRUNCATE public.policy_native_intent_reconciliation_restore_gates');
    await pool.query("INSERT INTO public.policy_native_intent_reconciliation_restore_gates VALUES(1,'ready')");
    expect(await maintain()).toEqual({ status: 'installed' });
  });
  test('authenticated restricted observer never installs or gains authority', async () => {
    expect(await readDatabaseProfilingStatus(restricted)).toEqual({ active: false, reason: 'extension_missing' });
    expect(await runDatabaseProfilingMaintenance({ database: { pool: restricted } })).toEqual({ status: 'deferred', reason: 'maintenance_authority_required' });
    expect(await exists()).toBe(false);
    expect(await maintain()).toEqual({ status: 'installed' });
    expect(await runDatabaseProfilingMaintenance({ database: { pool: restricted } })).toEqual({ status: 'already_active' });
  });
  test('error after real DDL rolls back and releases admission', async () => {
    const faulty = { connect: async () => {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => {
        if (args[0] === 'COMMIT') throw new Error('synthetic failure before commit');
        return query(...args);
      };
      return client;
    } };
    expect(await runDatabaseProfilingMaintenance({ database: { pool: faulty } })).toEqual({ status: 'deferred', reason: 'database_operation_unconfirmed' });
    expect(await exists()).toBe(false);
    expect(await maintain()).toEqual({ status: 'installed' });
  });
});
