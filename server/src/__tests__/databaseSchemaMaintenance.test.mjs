/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { createMigrationRunner } from '../config/migrations.mjs';
import { readSchemaMaintenanceMode } from '../config/schemaMaintenanceMode.mjs';
import { verifyRuntimeSchemaReadiness, verifySupervisedSchemaReadiness } from '../services/databaseSchemaReadiness.mjs';
import { runDatabaseSchemaMaintenance } from '../services/databaseSchemaMaintenance.mjs';
import { runSchemaMaintenanceCommand } from '../scripts/runDatabaseSchemaMaintenance.mjs';

const files = createMigrationRunner().getMigrationFiles();
const restricted = Object.fromEntries(['direct_login', 'restricted', 'no_membership',
  'no_database_create', 'no_schema_create', 'no_ownership'].map(key => [key, true]));

function setup(overrides = {}) {
  const state = { acquired: true, authority: restricted, ledger: files, gate: 'ready', gateTable: true, ...overrides };
  const client = new EventEmitter();
  client.release = jest.fn();
  client.query = jest.fn(async sql => {
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: state.acquired }] };
    if (sql.includes('AS direct_login')) return { rows: state.authority ? [state.authority] : [] };
    if (sql.includes("to_regclass('public.schema_migrations')")) return { rows: [{ ledger: state.ledger ? 'schema_migrations' : null }] };
    if (sql.startsWith('SELECT filename')) return { rows: state.ledger.map(filename => ({ filename })) };
    if (sql.includes('AS gate_table')) return { rows: [{ gate_table: state.gateTable ? 'gates' : null }] };
    if (sql.startsWith('SELECT gate_state')) return { rows: state.gate ? [{ gate_state: state.gate }] : [] };
    return { rows: [] };
  });
  const database = { pool: { connect: jest.fn().mockResolvedValue(client), end: jest.fn() } };
  const runner = { getMigrationFiles: jest.fn(() => files), run: jest.fn(async () => {
    state.ledger = files;
    state.gate = 'ready';
    return { applied: 0, total: files.length, method: 'migrations' };
  }) };
  const runnerFactory = jest.fn(() => runner);
  return { state, client, database, runner, runnerFactory,
    maintain: () => runDatabaseSchemaMaintenance({ database, runnerFactory }),
    verify: () => verifyRuntimeSchemaReadiness({ database, environment: {} }) };
}

test('schema mode defaults to startup and external is explicit', () => {
  expect(readSchemaMaintenanceMode({})).toBe('startup');
  expect(readSchemaMaintenanceMode({ CLASSIFARR_SCHEMA_MAINTENANCE: 'external' })).toBe('external');
});
test.each(['', 'EXTERNAL', ' external ', 'auto'])('rejects invalid schema mode %j', value => {
  expect(() => readSchemaMaintenanceMode({ CLASSIFARR_SCHEMA_MAINTENANCE: value })).toThrow('must be startup or external');
});
test('readiness checks are read-only, exact and dispose of their session', async () => {
  const s = setup();
  await expect(s.verify()).resolves.toEqual({ status: 'ready', total: files.length });
  expect(s.client.query.mock.calls[0]).toEqual(['BEGIN READ ONLY']);
  expect(s.client.query.mock.calls.at(-1)).toEqual(['COMMIT']);
  expect(s.client.query.mock.calls.some(([sql]) => /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\s+(?:TABLE|INTO|ROLE|EXTENSION)/.test(sql))).toBe(false);
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test.each(Object.keys(restricted))('rejects runtime authority: %s', async key => {
  const s = setup({ authority: { ...restricted, [key]: false } });
  await expect(s.verify()).rejects.toThrow('runtime_schema_authority_not_restricted');
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test('missing role row fails closed', async () => {
  await expect(setup({ authority: null }).verify()).rejects.toThrow('authority_not_restricted');
});
test.each([['absent', null], ['empty', []], ['pending', files.slice(1)]])('missing or pending schema prevents runtime startup: %s', async (_name, ledger) => {
  await expect(setup({ ledger }).verify()).rejects.toThrow('schema_maintenance_required');
});
test('future schema blocks maintenance and readiness', async () => {
  const s = setup({ ledger: [...files, '20990101_000000_future.sql'] });
  await expect(s.verify()).rejects.toThrow('schema_version_not_supported');
  await expect(s.maintain()).rejects.toThrow('schema_version_not_supported');
  expect(s.runner.run).not.toHaveBeenCalled();
});
test('missing package migrations cannot start the runtime', async () => {
  const s = setup();
  await expect(verifyRuntimeSchemaReadiness({ database: s.database,
    environment: { MIGRATIONS_DIR: 'nonexistent-schema-maintenance-test-directory' } })).rejects.toThrow('migration_files_unavailable');
  expect(s.database.pool.connect).not.toHaveBeenCalled();
});
test('active runtime defers with no runner or writes and destroys the session', async () => {
  const s = setup({ acquired: false });
  await expect(s.maintain()).resolves.toEqual({ status: 'deferred', reason: 'runtime_or_restore_active' });
  expect(s.client.query).toHaveBeenCalledTimes(1);
  expect(s.runnerFactory).not.toHaveBeenCalled();
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test('missing migration package fails before migrations', async () => {
  const s = setup();
  s.runner.getMigrationFiles.mockReturnValue([]);
  await expect(s.maintain()).rejects.toThrow('schema_migration_files_unavailable');
  expect(s.runner.run).not.toHaveBeenCalled();
});
test.each(['verifying', 'blocked', null])('restore state %s is not rewritten', async gate => {
  const s = setup({ gate });
  await expect(s.maintain()).rejects.toThrow('restore_verification_required');
  expect(s.runner.run).not.toHaveBeenCalled();
});
test('legacy missing row permits only the existing pending seed migration', async () => {
  const s = setup({ gate: null, ledger: files.filter(f => f !== '20260927_120000_seed_restore_admission_gate.sql') });
  await expect(s.maintain()).resolves.toMatchObject({ status: 'complete' });
});
test('first install and idempotent rerun use the runner and recheck ledger', async () => {
  const s = setup({ ledger: null, gateTable: false });
  await expect(s.maintain()).resolves.toMatchObject({ status: 'complete' });
  await expect(s.maintain()).resolves.toMatchObject({ status: 'complete' });
  expect(s.database.pool.connect).toHaveBeenCalledTimes(2);
  expect(s.client.release).toHaveBeenCalledTimes(2);
});
test('runner result alone cannot falsely mark an incomplete schema complete', async () => {
  const s = setup({ ledger: [] });
  s.runner.run.mockResolvedValue({ applied: 0 });
  await expect(s.maintain()).rejects.toThrow('schema_maintenance_incomplete');
});
test('restore gate is checked again after migrations', async () => {
  const s = setup();
  s.runner.run.mockImplementation(async () => { s.state.gate = 'blocked'; return {}; });
  await expect(s.maintain()).rejects.toThrow('restore_verification_required');
});
test.each([false, true])('transaction stays pinned and rolls back on error=%s', async fail => {
  const s = setup();
  s.runner.run.mockImplementation(async () => {
    const adapter = s.runnerFactory.mock.calls[0][0].dbClient;
    await adapter.withTransaction(async client => {
      await client.query('SELECT 42');
      if (fail) throw new Error('migration_failed');
    });
    return {};
  });
  if (fail) await expect(s.maintain()).rejects.toThrow('migration_failed');
  else await expect(s.maintain()).resolves.toMatchObject({ status: 'complete' });
  expect(s.database.pool.connect).toHaveBeenCalledTimes(1);
  expect(s.client.query).toHaveBeenCalledWith(fail ? 'ROLLBACK' : 'COMMIT');
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test('lost pinned session never reconnects or commits', async () => {
  const s = setup();
  s.runner.run.mockImplementation(async () => {
    const adapter = s.runnerFactory.mock.calls[0][0].dbClient;
    await adapter.withTransaction(async () => { s.client.emit('error', new Error('lost')); });
  });
  await expect(s.maintain()).rejects.toThrow('lost');
  expect(s.client.query).not.toHaveBeenCalledWith('COMMIT');
  expect(s.client.query).not.toHaveBeenCalledWith('ROLLBACK');
  expect(s.database.pool.connect).toHaveBeenCalledTimes(1);
  expect(s.client.listenerCount('error')).toBe(0);
});
test('readiness detects a connection error before accepting its result', async () => {
  const s = setup();
  s.client.query.mockImplementationOnce(async () => { s.client.emit('error', new Error('lost')); return {}; });
  await expect(s.verify()).rejects.toThrow('lost');
  expect(s.client.release).toHaveBeenCalledWith(true);
});

test('compatible readiness is read-only and verifies schema without pretending to restrict the shared identity', async () => {
  const s = setup({ authority: null });
  await expect(verifySupervisedSchemaReadiness({ database: s.database })).resolves.toMatchObject({ status: 'ready' });
  expect(s.client.query).toHaveBeenCalledWith('BEGIN READ ONLY');
  expect(s.client.query.mock.calls.some(([sql]) => sql.includes('AS direct_login'))).toBe(false);
  expect(s.client.query.mock.calls.some(([sql]) => sql.startsWith('SELECT gate_state'))).toBe(true);
  expect(s.client.query).toHaveBeenCalledWith('COMMIT');
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test.each([
  [{ ledger: null }, 'schema_maintenance_required'],
  [{ ledger: files.slice(1) }, 'schema_maintenance_required'],
  [{ ledger: [...files, '20990101_000000_future.sql'] }, 'schema_version_not_supported'],
  [{ gate: null }, 'restore_verification_required'],
  [{ gate: 'blocked' }, 'restore_verification_required'],
])('compatible readiness fails closed for %j', async (state, reason) => {
  const s = setup(state);
  await expect(verifySupervisedSchemaReadiness({ database: s.database })).rejects.toThrow(reason);
  expect(s.client.query).not.toHaveBeenCalledWith('COMMIT');
  expect(s.client.release).toHaveBeenCalledWith(true);
});
test('compatible readiness ignores inherited migration path overrides', async () => {
  const previous = process.env.MIGRATIONS_DIR;
  try {
    process.env.MIGRATIONS_DIR = 'nonexistent-supervised-migration-directory';
    await expect(verifySupervisedSchemaReadiness({ database: setup().database })).resolves.toMatchObject({ status: 'ready' });
  } finally {
    if (previous === undefined) delete process.env.MIGRATIONS_DIR;
    else process.env.MIGRATIONS_DIR = previous;
  }
});
test.each([[[], 0], [['--help'], 0], [['--wat'], 2], [['--apply', '--force'], 2]])('CLI args %j do not load the database', async (args, code) => {
  const loadDatabase = jest.fn();
  expect(await runSchemaMaintenanceCommand({ args, loadDatabase, output: jest.fn() })).toBe(code);
  expect(loadDatabase).not.toHaveBeenCalled();
});
test.each([['complete', 0], ['deferred', 75], ['failure', 1]])('CLI %s closes the owned pool and returns %s', async (status, code) => {
  const database = { pool: { end: jest.fn() } };
  const output = jest.fn();
  const run = jest.fn(async () => {
    if (status === 'failure') throw new Error('secret=do-not-print');
    return { status };
  });
  expect(await runSchemaMaintenanceCommand({ args: ['--apply'], loadDatabase: async () => database,
    loadMaintenance: async () => ({ runDatabaseSchemaMaintenance: run }), output })).toBe(code);
  expect(database.pool.end).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(output.mock.calls)).not.toContain('do-not-print');
});

test('CLI cleanup failure returns a failure code without printing driver secrets', async () => {
  const output = jest.fn();
  const database = { pool: { end: jest.fn().mockRejectedValue(new Error('secret')) } };
  expect(await runSchemaMaintenanceCommand({ args: ['--apply'], loadDatabase: async () => database,
    loadMaintenance: async () => ({ runDatabaseSchemaMaintenance: async () => ({ status: 'complete' }) }), output })).toBe(1);
  expect(JSON.stringify(output.mock.calls)).not.toContain('secret');
});
