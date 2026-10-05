/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { startSelectedMaintenance } from '../bootstrap/embeddedSelectedMaintenance.mjs';
import { selectedMaintenanceEnvironment, selectedMaintenanceTimeout, SELECTED_RESTORE_MAX_BYTES } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';
import { runSelectedMaintenance } from '../scripts/runSelectedMaintenance.mjs';
import { runSchemaMaintenanceCommand } from '../scripts/runDatabaseSchemaMaintenance.mjs';
import { SchemaRestoreVerificationRequiredError } from '../utils/schemaMaintenanceFailure.mjs';

const accounts = { users: [{ name: 'postgres', uid: 70, gid: 70 }, { name: 'classifarr', uid: 1000, gid: 1000 }] };
const context = { platform: 'linux', cwd: '/app', uid: 70, gid: 70, args: ['--schema'] };
function fixture() {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: jest.fn() });
  const spawnFn = jest.fn(() => child);
  return { child, spawnFn, options: { spawnFn, operation: 'schema', identity: { uid: 70, gid: 70 }, uid: 0, platform: 'linux' } };
}
const finish = (child, code = 0, signal = null) => { child.emit('exit', code, signal); child.emit('close', code, signal); };
const worker = extra => ({ environment: selectedMaintenanceEnvironment(), context,
  accounts: async () => accounts, assertNoEnvFile: jest.fn(), ...extra });

test.each(['schema', 'restore'])('launches fixed %s worker with no ambient credentials or paths', async operation => {
  const f = fixture(), request = operation === 'restore' ? Buffer.from('{"secret":"stdin-only"}') : null;
  const observed = startSelectedMaintenance({ ...f.options, operation, request });
  const [executable, args, options] = f.spawnFn.mock.calls[0];
  expect(executable).toBe('/sbin/su-exec');
  expect(args).toEqual(['70:70', '/usr/local/bin/node', '/app/src/scripts/runSelectedMaintenance.mjs', `--${operation}`]);
  expect(options).toEqual({ cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    timeout: operation === 'schema' ? 900_000 : 180_000, killSignal: 'SIGKILL', env: selectedMaintenanceEnvironment() });
  expect(JSON.stringify(f.spawnFn.mock.calls)).not.toContain('stdin-only');
  expect(f.child.stdin.read()?.toString() ?? null).toBe(request?.toString() ?? null);
  finish(f.child); expect(await observed.done).toEqual({ code: 0, signal: null });
});

test.each([{ uid: 1000 }, { platform: 'win32' }, { identity: { uid: 0, gid: 70 } },
  { identity: { uid: 70, gid: '70:0' } }, { operation: 'shell' }, { request: Buffer.from('x') },
  { operation: 'restore' }, { operation: 'restore', request: '{}' }, { operation: 'restore', request: Buffer.alloc(0) },
])('refuses invalid launch %j before spawn', change => {
  const f = fixture();
  expect(() => startSelectedMaintenance({ ...f.options, ...change })).toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});

test('restore byte limit is enforced before spawning', () => {
  const f = fixture();
  expect(() => startSelectedMaintenance({ ...f.options, operation: 'restore', request: Buffer.alloc(SELECTED_RESTORE_MAX_BYTES + 1) })).toThrow('request_invalid');
  expect(f.spawnFn).not.toHaveBeenCalled();
});

test.each(['overflow', 'stdout', 'stderr', 'stdin', 'signal'])('never reports restore refusal after %s', async fault => {
  const f = fixture(), report = jest.fn();
  const observed = startSelectedMaintenance({ ...f.options, report });
  if (fault === 'overflow') f.child.stdout.emit('data', Buffer.alloc(65537));
  else if (fault !== 'signal') f.child[fault].emit('error', new Error('private'));
  finish(f.child, 78, fault === 'signal' ? 'SIGKILL' : null);
  expect((await observed.done).code).not.toBe(0);
  expect(report).not.toHaveBeenCalled();
});

test('refusal reporting waits for stream closure and cannot change failed admission', async () => {
  const f = fixture(), report = jest.fn(() => { throw new Error('reporter'); });
  const observed = startSelectedMaintenance({ ...f.options, report });
  f.child.emit('exit', 78, null); await Promise.resolve();
  expect(report).not.toHaveBeenCalled();
  f.child.emit('close', 78, null);
  expect(await observed.done).toEqual({ code: 78, signal: null });
  expect(report).toHaveBeenCalledWith('maintenance_failed', 'restore_verification_required', undefined, expect.stringContaining('Restore verification is incomplete'));
});

test.each([{ uid: 0 }, { uid: 1000 }, { gid: 1000 }, { platform: 'win32' }, { cwd: '/tmp' },
  { args: [] }, { args: ['--restore', '--force'] }, { args: ['--schema;whoami'] },
])('worker refuses context %j before command imports', async change => {
  const loadSchema = jest.fn(), loadRestore = jest.fn();
  expect(await runSelectedMaintenance(worker({ context: { ...context, ...change }, loadSchema, loadRestore }))).toBe(1);
  expect(loadSchema).not.toHaveBeenCalled(); expect(loadRestore).not.toHaveBeenCalled();
});

test.each(['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER', 'NODE_OPTIONS', 'MIGRATIONS_DIR', 'PGPASSWORD', 'EXTRA'])('worker refuses changed/extra %s before imports', async key => {
  const loadSchema = jest.fn();
  expect(await runSelectedMaintenance(worker({ environment: { ...selectedMaintenanceEnvironment(), [key]: 'untrusted' }, loadSchema }))).toBe(1);
  expect(loadSchema).not.toHaveBeenCalled();
});

test('worker refuses colliding accounts and environment-file access failures', async () => {
  const loadSchema = jest.fn();
  expect(await runSelectedMaintenance(worker({ accounts: async () => ({ users: [...accounts.users, { name: 'alias', uid: 70, gid: 70 }] }), loadSchema }))).toBe(1);
  expect(await runSelectedMaintenance(worker({ assertNoEnvFile: async () => { throw new Error('present or inaccessible'); }, loadSchema }))).toBe(1);
  expect(loadSchema).not.toHaveBeenCalled();
});

test.each([['schema', 0], ['schema', 75], ['schema', 78], ['restore', 0], ['restore', 2], ['restore', 75], ['restore', 1]])('worker preserves %s command result %i', async (operation, code) => {
  const command = jest.fn(async () => code);
  const loadSchema = jest.fn(async () => ({ runSchemaMaintenanceCommand: command }));
  const loadRestore = jest.fn(async () => ({ runRestoreMaintenanceCommand: command }));
  expect(await runSelectedMaintenance(worker({ context: { ...context, args: [`--${operation}`] }, loadSchema, loadRestore }))).toBe(code);
  expect(command).toHaveBeenCalledWith({ args: ['--apply'] });
  expect(operation === 'schema' ? loadRestore : loadSchema).not.toHaveBeenCalled();
});

test('unknown load failure remains generic and operation vocabulary is closed', async () => {
  expect(await runSelectedMaintenance(worker({ loadSchema: async () => { throw new Error('secret'); } }))).toBe(1);
  expect(() => selectedMaintenanceTimeout('restore-file')).toThrow();
});

test.each(['schema', 'load', 'lookalike', 'cleanup'])('schema CLI only classifies a typed refusal in the schema phase (%s)', async phase => {
  const error = new SchemaRestoreVerificationRequiredError(), output = jest.fn();
  const database = { pool: { end: jest.fn(async () => { if (phase === 'cleanup') throw error; }) } };
  const code = await runSchemaMaintenanceCommand({ args: ['--apply'], output,
    loadDatabase: async () => { if (phase === 'load') throw error; return database; },
    loadMaintenance: async () => ({ runDatabaseSchemaMaintenance: async () => {
      if (phase === 'lookalike') throw new Error(error.message);
      throw error;
    } }),
  });
  expect(code).toBe(phase === 'schema' ? 78 : 1);
  expect(output.mock.calls.flat().join(' ')).not.toContain(error.message);
});
