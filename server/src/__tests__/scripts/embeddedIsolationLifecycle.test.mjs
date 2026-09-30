/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';

const fs = Object.fromEntries(['mkdir', 'chown', 'chmod', 'readFile', 'readdir', 'writeFile'].map(name => [name, jest.fn()]));
const commands = Object.fromEntries(['asUser', 'startRuntime', 'waitForRuntime', 'stopRuntime'].map(name => [name, jest.fn()]));
jest.unstable_mockModule('node:fs/promises', () => fs);
jest.unstable_mockModule('../../scripts/embeddedIsolationDrill/processes.mjs', () => commands);
const { runEmbeddedIsolationDrill } = await import('../../scripts/runEmbeddedIsolationDrill.mjs');

const mounts = ['/', '/rehearsal', '/app/data', '/run/postgresql'].map(path => `1 2 3 4 ${path} ro - overlay overlay ro`).join('\n');
let originalUid;
let originalPlatform;
let events;
beforeEach(() => {
  jest.resetAllMocks();
  originalUid = Object.getOwnPropertyDescriptor(process, 'getuid');
  originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'getuid', { value: () => 0, configurable: true });
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  jest.replaceProperty(process, 'argv', ['node', 'drill']);
  jest.replaceProperty(process, 'env', { CLASSIFARR_EMBEDDED_ISOLATION_DRILL: 'disposable-v1' });
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 401 });
  fs.readdir.mockImplementation(async path => path === '/sys/class/net' ? ['lo'] : []);
  fs.readFile.mockImplementation(async path => path === '/proc/self/mountinfo' ? mounts
    : path === '/etc/passwd' ? 'postgres:x:70:70:postgres:/var/lib/postgresql:/bin/sh\n' : 'database system is ready');
  events = [];
  let maintenanceCount = 0;
  commands.asUser.mockImplementation(async (user, command, args) => {
    events.push(`${user}:${command}:${args.join(' ')}`);
    if (args[0] === 'src/scripts/runDatabaseSchemaMaintenance.mjs' && ++maintenanceCount === 3) {
      throw Object.assign(new Error('busy'), { code: 75 });
    }
    return { stdout: 'Database cluster state: shut down\n' };
  });
  commands.startRuntime.mockImplementation(() => { events.push('start_runtime'); return { child: {} }; });
  commands.stopRuntime.mockImplementation(async runtime => { if (runtime) events.push('stop_runtime'); });
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(process, 'platform', originalPlatform);
  if (originalUid) Object.defineProperty(process, 'getuid', originalUid);
  else delete process.getuid;
});

test('real commands are ordered behind identity checks and a stopped runtime', async () => {
  const result = await runEmbeddedIsolationDrill();
  expect(result).toMatchObject({ status: 'passed', productionCutover: false });
  expect(result.checks).toHaveLength(5);
  const stops = events.flatMap((value, index) => value === 'stop_runtime' ? [index] : []);
  const dump = events.findIndex(value => value.startsWith('postgres:pg_dump:'));
  const databaseStops = events.flatMap((value, index) => value.startsWith('postgres:pg_ctl:') && value.endsWith(' stop') ? [index] : []);
  expect(stops[0]).toBeLessThan(dump);
  expect(events.findIndex(value => value.includes('restoreProbe.mjs --busy'))).toBeLessThan(stops[0]);
  expect(stops[0]).toBeLessThan(events.findIndex(value => value.includes('restoreProbe.mjs --apply')));
  expect(dump).toBeLessThan(databaseStops[0]);
  expect(stops[1]).toBeLessThan(databaseStops[1]);
  expect(events.some(value => value.includes('runtimeProbe.mjs --restored'))).toBe(true);
  expect(commands.asUser.mock.calls.filter(([, command]) => command === 'pg_controldata')).toHaveLength(2);
});

test.each(['wrong-mode', 'wrong-platform', 'wrong-uid', 'extra-argument', 'occupied', 'root-db-user', 'invalid-db-user', 'writable-root'])('%s fails before initializing PostgreSQL', async scenario => {
  if (scenario === 'wrong-mode') process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL = 'live';
  if (scenario === 'wrong-platform') Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  if (scenario === 'wrong-uid') Object.defineProperty(process, 'getuid', { value: () => 1000, configurable: true });
  if (scenario === 'extra-argument') process.argv.push('--live');
  if (scenario === 'occupied') fs.readdir.mockImplementation(async path => path === '/sys/class/net' ? ['lo'] : ['PG_VERSION']);
  if (scenario === 'root-db-user' || scenario === 'invalid-db-user') fs.readFile.mockImplementation(async path =>
    path === '/proc/self/mountinfo' ? mounts : scenario === 'root-db-user' ? 'postgres:x:0:0:x:x:x' : 'postgres:x:bad:70:x:x:x');
  if (scenario === 'writable-root') fs.readFile.mockResolvedValue(mounts.replace('/ ro', '/ rw'));
  await expect(runEmbeddedIsolationDrill()).rejects.toThrow();
  expect(commands.asUser).not.toHaveBeenCalled();
});

test.each(['probe', 'restore', 'index'])('%s failure cannot pass and still stops PostgreSQL', async scenario => {
  const original = commands.asUser.getMockImplementation();
  commands.asUser.mockImplementation(async (...args) => {
    if ((scenario === 'probe' && args[2][0]?.endsWith('runtimeProbe.mjs'))
      || (scenario === 'restore' && args[1] === 'pg_restore')
      || (scenario === 'index' && args[2][0]?.endsWith('maintenanceProbe.mjs'))) throw new Error('scenario_failed');
    return original(...args);
  });
  await expect(runEmbeddedIsolationDrill()).rejects.toThrow('scenario_failed');
  expect(events.some(value => value.endsWith(' stop'))).toBe(true);
});

test('startup failure still joins Node before stopping PostgreSQL', async () => {
  commands.waitForRuntime.mockRejectedValue(new Error('not_ready'));
  await expect(runEmbeddedIsolationDrill()).rejects.toThrow('not_ready');
  expect(events.indexOf('stop_runtime')).toBeLessThan(events.findIndex(value => value.endsWith(' stop')));
});

test.each(['unexpected-maintenance-success', 'unexpected-maintenance-error', 'unclean-control', 'crash-recovery', 'auth-bypass'])('%s is evidence failure, never a passing drill', async scenario => {
  const original = commands.asUser.getMockImplementation();
  commands.asUser.mockImplementation(async (...args) => {
    try {
      const result = await original(...args);
      return scenario === 'unclean-control' && args[1] === 'pg_controldata' ? { stdout: 'in production' } : result;
    } catch (error) {
      if (scenario === 'unexpected-maintenance-success') return { stdout: 'complete' };
      if (scenario === 'unexpected-maintenance-error') throw Object.assign(new Error('failure'), { code: 1 });
      throw error;
    }
  });
  if (scenario === 'crash-recovery') fs.readFile.mockImplementation(async path => path === '/proc/self/mountinfo' ? mounts
    : path === '/etc/passwd' ? 'postgres:x:70:70:x:x:x' : 'database system was interrupted');
  if (scenario === 'auth-bypass') globalThis.fetch.mockResolvedValue({ status: 200 });
  await expect(runEmbeddedIsolationDrill()).rejects.toThrow();
});
