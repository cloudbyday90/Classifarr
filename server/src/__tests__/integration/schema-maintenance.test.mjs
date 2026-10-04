/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, beforeAll, afterAll, test, expect, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { readRuntime } from './runtime.mjs';
import { createMigrationRunner } from '../../config/migrations.mjs';
import { runDatabaseSchemaMaintenance } from '../../services/databaseSchemaMaintenance.mjs';
import { verifyRuntimeSchemaReadiness, verifySupervisedSchemaReadiness } from '../../services/databaseSchemaReadiness.mjs';
import { acquireNormalRuntimeAdmission } from '../../bootstrap/runtimeAdmission.mjs';
import { withBackupRestoreSession } from '../../services/backupRestoreSession.mjs';

function identifier(value) {
  if (!/^cf_schema_[a-f0-9]+$/.test(value)) throw new Error('unowned_fixture_identifier');
  return `"${value}"`;
}

describe('one-shot schema maintenance and authenticated runtime readiness', () => {
  let runtimePool, config, role, parentRole;
  const admin = () => ({ pool: getPool() });
  const maintain = (options = {}) => runDatabaseSchemaMaintenance({ database: admin(), ...options });
  const verify = () => verifyRuntimeSchemaReadiness({ database: { pool: runtimePool } });
  beforeAll(async () => {
    const runtime = readRuntime();
    const database = (await getPool().query('SELECT current_database() AS name')).rows[0].name;
    role = `cf_schema_${randomUUID().replaceAll('-', '')}`;
    parentRole = `cf_schema_${randomUUID().replaceAll('-', '')}`;
    const password = randomUUID();
    // Password is generated, not supplied by a user or read from a live installation.
    await getPool().query(`CREATE ROLE ${identifier(role)} LOGIN PASSWORD '${password}'`);
    await getPool().query(`CREATE ROLE ${identifier(parentRole)} NOLOGIN`);
    await getPool().query(`GRANT USAGE ON SCHEMA public TO ${identifier(role)}`);
    await getPool().query(`GRANT SELECT ON public.schema_migrations,
      public.policy_native_intent_reconciliation_restore_gates TO ${identifier(role)}`);
    config = { host: runtime.host, port: runtime.port, database, user: role, password,
      max: 3, connectionTimeoutMillis: 5000, statement_timeout: 5000 };
    runtimePool = new pg.Pool(config);
  });
  afterAll(async () => {
    await runtimePool?.end();
    if (role) {
      await getPool().query(`DROP OWNED BY ${identifier(role)}, ${identifier(parentRole)}`);
      await getPool().query(`DROP ROLE ${identifier(role)}, ${identifier(parentRole)}`);
    }
  });

  test('current real schema is idempotent and a separately authenticated runtime passes twice', async () => {
    await expect(maintain()).resolves.toMatchObject({ status: 'complete', applied: 0 });
    await expect(maintain()).resolves.toMatchObject({ status: 'complete', applied: 0 });
    await expect(verify()).resolves.toMatchObject({ status: 'ready' });
    await runtimePool.end();
    runtimePool = new pg.Pool(config);
    await expect(verify()).resolves.toMatchObject({ status: 'ready' });
  });
  test('bootstrap/admin credential is refused for external runtime startup', async () => {
    await expect(verifyRuntimeSchemaReadiness({ database: admin() })).rejects.toThrow('authority_not_restricted');
  });
  test('compatible handoff verifies current schema with existing credentials under runtime admission', async () => {
    const admission = await acquireNormalRuntimeAdmission({ database: admin(), onLost: jest.fn(), seedMissingGate: async () => false });
    try {
      await expect(verifySupervisedSchemaReadiness({ database: admin() })).resolves.toMatchObject({ status: 'ready' });
      await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
    } finally { admission.release(); }
  });
  test('shared runtime admission prevents schema execution until the last owner exits', async () => {
    const first = await acquireNormalRuntimeAdmission({ database: { pool: runtimePool }, onLost: jest.fn() });
    const second = await acquireNormalRuntimeAdmission({ database: { pool: runtimePool }, onLost: jest.fn() });
    try {
      await expect(maintain()).resolves.toEqual({ status: 'deferred', reason: 'runtime_or_restore_active' });
      first.release();
      await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
    } finally { first.release(); second.release(); }
    await expect(maintain()).resolves.toMatchObject({ status: 'complete' });
  });
  test('restore and schema maintenance share exclusive admission', async () => {
    await withBackupRestoreSession({ database: admin() }, async () => {
      await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
    });
  });
  test('schema owner blocks normal admission and another maintenance invocation', async () => {
    let entered = false;
    await maintain({ runnerFactory: options => {
      const runner = createMigrationRunner(options);
      const run = runner.run.bind(runner);
      runner.run = async () => {
        entered = true;
        await expect(acquireNormalRuntimeAdmission({ database: { pool: runtimePool }, onLost: jest.fn() })).rejects.toThrow('Normal startup is blocked');
        await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
        return run();
      };
      return runner;
    } });
    expect(entered).toBe(true);
  });
  test.each(['CREATEDB', 'CREATEROLE', 'REPLICATION', 'BYPASSRLS'])('elevated role attribute %s is rejected', async attribute => {
    // Fixed test matrix only, never caller-supplied SQL.
    await getPool().query(`ALTER ROLE ${identifier(role)} ${attribute}`);
    try { await expect(verify()).rejects.toThrow('authority_not_restricted'); }
    finally { await getPool().query(`ALTER ROLE ${identifier(role)} NO${attribute}`); }
  });
  test('non-inheriting membership is rejected even though authority needs SET ROLE', async () => {
    await getPool().query(`GRANT ${identifier(parentRole)} TO ${identifier(role)} WITH INHERIT FALSE, SET TRUE`);
    try { await expect(verify()).rejects.toThrow('authority_not_restricted'); }
    finally { await getPool().query(`REVOKE ${identifier(parentRole)} FROM ${identifier(role)}`); }
  });
  test('schema CREATE and object ownership are independently rejected', async () => {
    await getPool().query(`GRANT CREATE ON SCHEMA public TO ${identifier(role)}`);
    try { await expect(verify()).rejects.toThrow('authority_not_restricted'); }
    finally { await getPool().query(`REVOKE CREATE ON SCHEMA public FROM ${identifier(role)}`); }
    await getPool().query(`CREATE TABLE public.schema_boundary_owned(id integer)`);
    await getPool().query(`ALTER TABLE public.schema_boundary_owned OWNER TO ${identifier(role)}`);
    try { await expect(verify()).rejects.toThrow('authority_not_restricted'); }
    finally { await getPool().query('DROP TABLE public.schema_boundary_owned'); }
  });
  test('missing ledger fails read-only and maintenance does not accept a future ledger', async () => {
    await getPool().query('ALTER TABLE public.schema_migrations RENAME TO schema_boundary_saved_ledger');
    try {
      await expect(verify()).rejects.toThrow('schema_maintenance_required');
      await expect(verifySupervisedSchemaReadiness({ database: admin() })).rejects.toThrow('schema_maintenance_required');
    }
    finally { await getPool().query('ALTER TABLE public.schema_boundary_saved_ledger RENAME TO schema_migrations'); }
    const filename = '20990930_000000_schema_boundary_future.sql';
    await getPool().query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
    try {
      await expect(verify()).rejects.toThrow('schema_version_not_supported');
      await expect(maintain()).rejects.toThrow('schema_version_not_supported');
    } finally { await getPool().query('DELETE FROM schema_migrations WHERE filename=$1', [filename]); }
  });
  test('pending migration blocks readiness, applies atomically and is idempotent', async () => {
    const filename = '20990930_000001_schema_boundary_fixture.sql';
    const sql = 'CREATE TABLE public.schema_boundary_migrated (id integer PRIMARY KEY);';
    const factory = options => createMigrationRunner({ ...options, fileSystem: {
      existsSync: fs.existsSync,
      readdirSync: directory => [...fs.readdirSync(directory), filename],
      readFileSync: (file, encoding) => path.basename(file) === filename ? sql : fs.readFileSync(file, encoding),
    } });
    try {
      await expect(maintain({ runnerFactory: factory })).resolves.toMatchObject({ status: 'complete', applied: 1 });
      await expect(maintain({ runnerFactory: factory })).resolves.toMatchObject({ status: 'complete', applied: 0 });
      expect((await getPool().query("SELECT to_regclass('public.schema_boundary_migrated') AS object")).rows[0].object).toBeTruthy();
      // The original runtime package must not accept a newer schema.
      await expect(verify()).rejects.toThrow('schema_version_not_supported');
    } finally {
      await getPool().query('DROP TABLE IF EXISTS public.schema_boundary_migrated');
      await getPool().query('DELETE FROM schema_migrations WHERE filename=$1', [filename]);
    }
    const latest = createMigrationRunner().getMigrationFiles().at(-1);
    const original = (await getPool().query('DELETE FROM schema_migrations WHERE filename=$1 RETURNING *', [latest])).rows[0];
    try { await expect(verify()).rejects.toThrow('schema_maintenance_required'); }
    finally { await getPool().query('INSERT INTO schema_migrations(id,filename,applied_at) VALUES ($1,$2,$3)', [original.id, original.filename, original.applied_at]); }
  });
  test('failed real migration rolls back its DDL and ledger, releasing maintenance admission', async () => {
    const filename = '20990930_000002_schema_boundary_failure.sql';
    const factory = options => createMigrationRunner({ ...options, fileSystem: {
      existsSync: fs.existsSync,
      readdirSync: directory => [...fs.readdirSync(directory), filename],
      readFileSync: (file, encoding) => path.basename(file) === filename
        ? 'CREATE TABLE public.schema_boundary_rollback(id integer); SELECT 1/0;' : fs.readFileSync(file, encoding),
    } });
    await expect(maintain({ runnerFactory: factory })).rejects.toThrow('division by zero');
    expect((await getPool().query("SELECT to_regclass('public.schema_boundary_rollback') AS object")).rows[0].object).toBeNull();
    expect((await getPool().query('SELECT 1 FROM schema_migrations WHERE filename=$1', [filename])).rowCount).toBe(0);
    await expect(maintain()).resolves.toMatchObject({ status: 'complete' });
  });
  test('quarantined restore is preserved and refuses maintenance', async () => {
    await getPool().query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state='requires_maintenance' WHERE gate_id=1");
    try {
      await expect(maintain()).rejects.toThrow('restore_verification_required');
      await expect(verifySupervisedSchemaReadiness({ database: admin() })).rejects.toThrow('restore_verification_required');
    }
    finally { await getPool().query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state='ready' WHERE gate_id=1"); }
  });
  test('fresh private database is initialized before any runtime exists', async () => {
    const name = `cf_schema_${randomUUID().replaceAll('-', '')}`;
    const runtime = readRuntime();
    await getPool().query(`CREATE DATABASE ${identifier(name)} TEMPLATE template0`);
    const freshPool = new pg.Pool({ host: runtime.host, port: runtime.port,
      database: name, user: runtime.user, password: runtime.password, max: 2 });
    try {
      const database = { pool: freshPool };
      await expect(runDatabaseSchemaMaintenance({ database })).resolves.toMatchObject({ status: 'complete' });
      await expect(runDatabaseSchemaMaintenance({ database })).resolves.toMatchObject({ status: 'complete', applied: 0 });
    } finally {
      await freshPool.end();
      // Only the generated, validated fixture database created above is removed.
      await getPool().query(`DROP DATABASE ${identifier(name)}`);
    }
  }, 120000);
});
