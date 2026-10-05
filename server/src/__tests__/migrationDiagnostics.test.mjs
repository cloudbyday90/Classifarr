/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMigrationDiagnostics } from '../services/migrationDiagnostics.mjs';
import { createMigrationDiagnosticStore } from '../services/migrationDiagnosticStore.mjs';
import { readMigrationDiagnostic, createMigrationDiagnosticReader } from '../services/migrationDiagnosticReader.mjs';
import { migrationDiagnosticGuidance, sanitizeMigrationError, MAX_DIAGNOSTIC_BYTES } from '../services/migrationDiagnosticContract.mjs';
import { runMigrationDiagnosticCommand } from '../scripts/readMigrationDiagnostics.mjs';
import { createMigrationRunner } from '../config/migrations.mjs';
import { runDatabaseSchemaMaintenance } from '../services/databaseSchemaMaintenance.mjs';

let directory, environment, store;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'classifarr-diagnostic-test-'));
  environment = { LOG_DIR: directory, POSTGRES_DB: 'synthetic_test' };
  store = createMigrationDiagnosticStore({ environment });
});
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
const filename = '20990101_000000_synthetic_failure.sql';
async function failure(error = new Error('secret payload'), overrides = {}) {
  const diagnostics = createMigrationDiagnostics({ environment, store, enabled: true, ...overrides });
  await expect(diagnostics.run(async record => {
    record('migration_execute', { migration: filename, contentHash: 'a'.repeat(64) });
    record('migration_failed', { migration: filename, error });
    throw error;
  })).rejects.toBe(error);
  return store.read();
}

test('unknown failure survives restart with ordered context, causes and sanitized stack locations', async () => {
  const cause = Object.assign(new Error('password and row values'), { code: 'P0001', detail: 'secret row', query: 'secret SQL' });
  const error = new Error('connection postgres://secret', { cause });
  error.stack = 'Error: secret\n    at work (/app/src/config/migrations.mjs:12:3)\n    at query (node:internal/task_queues:99:5)\n    at private (/private/secret.js:1:2)';
  await failure(error);
  const result = await createMigrationDiagnosticStore({ environment }).read();
  expect(result.status).toBe('available');
  const report = result.report;
  expect(report.outcome).toBe('failed');
  expect(report.events.map(event => event.step)).toEqual(['attempt_started', 'migration_execute', 'migration_failed', 'attempt_failed']);
  expect(report.events[2].errors[0].frames).toEqual(['src/config/migrations.mjs:12:3', 'node:internal/task_queues:99:5']);
  expect(report.events[2].errors[1].code).toBe('P0001');
  expect(report.runtime.node).toBe(process.version);
  expect(report.startedAt <= report.finishedAt).toBe(true);
  expect(JSON.stringify(report)).not.toMatch(/secret|password|postgres:\/\//);
  expect(report.limitations).toContain('not a complete server log');
});
test('a healthy or deferred operation creates no files and does not erase previous failure', async () => {
  const runner = createMigrationDiagnostics({ environment, store, enabled: true });
  expect(await runner.run(async () => ({ status: 'deferred' }))).toEqual({ status: 'deferred' });
  expect(await fs.readdir(directory)).toEqual([]);
  const before = await failure();
  await runner.run(async () => true);
  expect(await store.read()).toEqual(before);
});
test('recovered snapshot failures are clearly labelled', async () => {
  await createMigrationDiagnostics({ environment, store, enabled: true }).run(async record => {
    record('snapshot_failed', { migration: 'current.sql', error: new Error('synthetic') });
    return true;
  });
  expect((await store.read()).report.outcome).toBe('recovered');
});
test('test mode performs no writes unless explicitly enabled', async () => {
  const write = jest.fn();
  const error = new Error('failure');
  await failure(error, { environment: { NODE_ENV: 'test' }, enabled: false, store: { write } });
  expect(write).not.toHaveBeenCalled();
});
test('disk failure does not mask the original exception', async () => {
  await failure(new Error('original'), { store: { write: async () => { throw Object.assign(new Error('disk'), { code: 'ENOSPC' }); } } });
  expect(await store.read()).toEqual({ status: 'none' });
});
test('failed atomic replacement preserves the previous report and removes only its own temporary file', async () => {
  const original = await failure();
  const brokenStore = createMigrationDiagnosticStore({ environment, fileSystem: { ...fs,
    rename: async () => { throw Object.assign(new Error('sensitive path'), { code: 'EIO' }); },
  } });
  await expect(brokenStore.write(original.report)).rejects.toMatchObject({ code: 'EIO' });
  expect(await store.read()).toEqual(original);
  expect(await fs.readdir(path.join(directory, 'schema-migrations'))).toEqual(['last-failure.json']);
});
test('event and byte limits retain last failure and count omissions', async () => {
  const diagnostics = createMigrationDiagnostics({ environment, store, enabled: true });
  const error = new Error('synthetic');
  error.stack = 'Error: sensitive\n' + '    at work (/app/src/services/migrationDiagnostics.mjs:100:200)\n'.repeat(20);
  await expect(diagnostics.run(async record => {
    for (let index = 0; index < 600; index++) record('migration_failed', { migration: filename, error });
    throw error;
  })).rejects.toBe(error);
  const { report } = await store.read();
  expect(report.events.length).toBeLessThanOrEqual(512);
  expect(report.omittedEvents).toBeGreaterThan(88);
  expect(report.events.at(-1).step).toBe('attempt_failed');
  expect((await fs.stat(path.join(directory, 'schema-migrations/last-failure.json'))).size).toBeLessThanOrEqual(MAX_DIAGNOSTIC_BYTES);
});
test('cyclic and overlong error causes are bounded and marked', () => {
  let error = new Error('secret');
  error.cause = error;
  expect(sanitizeMigrationError(error)).toMatchObject({ errors: [{ code: 'unknown' }], errorChainTruncated: true });
  for (let index = 0; index < 10; index++) error = new Error('secret', { cause: error });
  expect(sanitizeMigrationError(error).errors).toHaveLength(8);
  expect(sanitizeMigrationError(error).errorChainTruncated).toBe(true);
  expect(sanitizeMigrationError('secret').errors[0]).toMatchObject({ code: 'unknown', reason: 'unknown', frames: [] });
});
test('aggregate errors and throwing error accessors retain safe context without masking failure', async () => {
  const network = Object.assign(new Error('private address'), { code: 'ECONNREFUSED' });
  const error = new AggregateError([network, new Error('unknown')], 'secret');
  const { report } = await failure(error);
  expect(report.events.at(-1).errors).toEqual(expect.arrayContaining([expect.objectContaining({ parent: 0, relation: 'aggregate', code: 'ECONNREFUSED' })]));
  const malformed = Object.defineProperty({}, 'stack', { get() { throw new Error('secret getter'); } });
  expect(sanitizeMigrationError(malformed).errors[0].frames).toEqual([]);
});
test.each(['42501', 'EACCES', '55P03', '57014', '53100', 'ENOSPC', '08006', 'ECONNREFUSED', 'P0001'])('provides fixed guidance for %s', async code => {
  const { report } = await failure(Object.assign(new Error('secret'), { code }));
  expect(migrationDiagnosticGuidance(report)).not.toContain('secret');
  expect(migrationDiagnosticGuidance(report).length).toBeGreaterThan(50);
});
test('configured target mismatch withholds the old report; no credentials affect correlation', async () => {
  await failure();
  expect(await readMigrationDiagnostic({ environment: { ...environment, POSTGRES_DB: 'other' }, store })).toEqual({ status: 'target_mismatch' });
  expect((await readMigrationDiagnostic({ environment: { ...environment, POSTGRES_PASSWORD: 'rotated' }, store })).status).toBe('available');
});
test('a recovered earlier error cannot override guidance for the final unknown failure', async () => {
  const { report } = await failure();
  report.events.unshift({ errors: [{ code: '42501' }] });
  expect(migrationDiagnosticGuidance(report)).toContain('unknown failure');
  report.outcome = 'recovered';
  expect(migrationDiagnosticGuidance(report)).toContain('attempt completed');
});
test('corrupt, oversized or extra-field reports are never served', async () => {
  const { report } = await failure();
  const file = path.join(directory, 'schema-migrations/last-failure.json');
  for (const data of ['{', 'x'.repeat(MAX_DIAGNOSTIC_BYTES + 1), JSON.stringify({ ...report, secret: 'injected' })]) {
    await fs.writeFile(file, data);
    expect(await store.read()).toEqual({ status: 'unavailable' });
  }
});
test('symlinked root is refused', async () => {
  const target = await fs.mkdtemp(path.join(directory, 'owned-target-'));
  await fs.symlink(target, path.join(directory, 'schema-migrations'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(await store.read()).toEqual({ status: 'unavailable' });
});
test('orphan temporary entry limit refuses a new write without deleting evidence', async () => {
  const { report } = await failure();
  const root = path.join(directory, 'schema-migrations');
  for (let index = 0; index < 7; index++) await fs.writeFile(path.join(root, `orphan-${index}`), 'retained');
  await expect(store.write(report)).rejects.toThrow('entries_limit');
  expect(await fs.readdir(root)).toHaveLength(8);
});
test.each([true, false])('admin read compares the current ledger without writing: applied=%s', async applied => {
  await failure();
  const client = { release: jest.fn(), query: jest.fn(async sql => {
    if (sql.includes('FROM users')) return { rows: [{ role: 'admin', is_active: true }] };
    if (sql.includes('to_regclass')) return { rows: [{ ledger: 'schema_migrations' }] };
    if (sql.includes('SELECT 1 FROM')) return { rows: applied ? [{}] : [] };
    return { rows: [] };
  }) };
  const read = createMigrationDiagnosticReader({ pool: { connect: async () => client } }, { environment, store });
  expect((await read(1)).ledgerStatus).toBe(applied ? 'applied_since_failure' : 'not_recorded');
  expect((await read(1)).needsIssue).toBe(!applied);
  expect(client.query).toHaveBeenCalledWith('SELECT 1 FROM public.schema_migrations WHERE filename = $1', [filename]);
  expect(client.query.mock.calls.some(([sql]) => /INSERT|DELETE|UPDATE|CREATE|ALTER/.test(sql))).toBe(false);
  expect(client.release).toHaveBeenCalledWith(true);
});
test('unknown failures explicitly request a GitHub issue with reviewed sanitized evidence', async () => {
  await failure();
  const result = await readMigrationDiagnostic({ environment, store });
  expect(result.needsIssue).toBe(true);
  expect(result.guidance).toContain('Open a GitHub issue');
  expect(result.issueUrl).toBe('https://github.com/cloudbyday90/Classifarr/issues');
  expect(result.guidance).toContain('do not include credentials or raw database logs');
  await failure(Object.assign(new Error('sensitive path'), { code: 'ENOSPC' }));
  expect((await readMigrationDiagnostic({ environment, store })).needsIssue).toBe(false);
});
test('disabled administrator cannot read a saved report', async () => {
  const readStore = { read: jest.fn() };
  const client = { release: jest.fn(), query: jest.fn(async () => ({ rows: [] })) };
  await expect(createMigrationDiagnosticReader({ pool: { connect: async () => client } }, { store: readStore })(1)).rejects.toThrow('active administrator');
  expect(readStore.read).not.toHaveBeenCalled();
  expect(client.release).toHaveBeenCalledWith(true);
});
test('offline command has no mutation/path switches and hides unexpected reader errors', async () => {
  const output = jest.fn(), read = jest.fn(async () => ({ status: 'none' }));
  expect(await runMigrationDiagnosticCommand({ args: ['--apply'], read, output })).toBe(2);
  expect(read).not.toHaveBeenCalled();
  expect(await runMigrationDiagnosticCommand({ args: ['--help'], read, output })).toBe(0);
  expect(await runMigrationDiagnosticCommand({ args: [], read, output })).toBe(1);
  read.mockResolvedValue({ status: 'available' });
  expect(await runMigrationDiagnosticCommand({ args: [], read, output })).toBe(0);
  read.mockRejectedValue(new Error('secret'));
  expect(await runMigrationDiagnosticCommand({ args: [], read, output })).toBe(1);
  expect(output.mock.calls.flat().join(' ')).not.toContain('secret');
});
test('runner records SQL and ledger steps and preserves the original SQL exception as cause', async () => {
  const error = Object.assign(new Error('sensitive SQL error'), { code: '23505' });
  const query = jest.fn(async sql => {
    if (sql.includes('SELECT EXISTS')) return { rows: [{ exists: true }] };
    if (sql.startsWith('SELECT filename')) return { rows: [] };
    throw error;
  });
  const runner = createMigrationRunner({ dbClient: { query, withTransaction: callback => callback({ query }) },
    fileSystem: { existsSync: () => true, readdirSync: () => [filename], readFileSync: () => 'SELECT sensitive' },
    diagnostics: createMigrationDiagnostics({ environment, store, enabled: true }) });
  await expect(runner.run()).rejects.toMatchObject({ message: `Migration failed: ${filename}`, cause: error });
  expect((await store.read()).report.events.some(event => event.step === 'migration_execute' && event.contentHash)).toBe(true);
  expect(JSON.stringify(await store.read())).not.toContain('sensitive');
});
test('connection failures before a session exists are recorded', async () => {
  const error = Object.assign(new Error('postgres://secret'), { code: 'ECONNREFUSED' });
  await expect(runDatabaseSchemaMaintenance({ database: { pool: { connect: async () => { throw error; } } }, environment,
    diagnostics: createMigrationDiagnostics({ environment, store, enabled: true }) })).rejects.toBe(error);
  expect((await store.read()).report.events.map(event => event.step)).toEqual(['attempt_started', 'database_connect', 'attempt_failed']);
});
