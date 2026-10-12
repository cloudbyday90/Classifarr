/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';
const image = `sha256:${'a'.repeat(64)}`;
let container, remaining, actualMemory, host, failure;
const stopped = jest.fn();
const execute = jest.fn(async (_file, args) => ({ stdout: args[0] === 'image' ? image
  : args[0] === 'ps' ? remaining : [image, actualMemory, 2e9, 256, { '5432/tcp': [{ HostIp: '127.0.0.1' }] }].map(value => JSON.stringify(value)).join('|') }));
const execFile = () => {};
execFile[Symbol.for('nodejs.util.promisify.custom')] = execute;
jest.unstable_mockModule('node:child_process', () => ({ execFile }));
jest.unstable_mockModule('@testcontainers/postgresql', () => ({ PostgreSqlContainer: class {
  constructor(value) { this.image = value; this.hostConfig = {}; container = this; }
  withDatabase(value) { this.database = value; return this; }
  withUsername() { return this; }
  withPassword() { return this; }
  withResourcesQuota(value) { this.quota = value; return this; }
  withPullPolicy(value) { this.pull = value; return this; }
  withStartupTimeout(value) { this.startup = value; return this; }
  async start() { await this.beforeContainerCreated(); return this; }
  getId() { return 'owned-id'; }
  getHost() { return host; }
  stop() { return stopped(); }
} }));
const lifecycle = jest.fn(async options => {
  const owned = await options.start('fixture-password');
  try { if (failure) throw failure; return { kind: 'measured' }; }
  finally { await owned.stop(); }
});
jest.unstable_mockModule('../scripts/runLibraryScanRecoveryBenchmark.mjs', () => ({ runLibraryScanRecoveryBenchmark: lifecycle }));
const { runDescriptionCorpusProfile } = await import('../scripts/runDescriptionCorpusProfile.mjs');
beforeEach(() => { remaining = ''; actualMemory = 1024 ** 3; host = '127.0.0.1'; failure = null;
  stopped.mockClear(); execute.mockClear(); lifecycle.mockClear(); });

test('immutable image, no pulls, bounded resources, loopback port and independent cleanup check', async () => {
  expect(await runDescriptionCorpusProfile([])).toEqual({ kind: 'measured', databaseImageId: image, containerCleanupVerified: true });
  expect(container.image).toBe(image);
  expect(container.quota).toEqual({ memory: 1, cpu: 2 });
  expect(container.hostConfig).toEqual({ PidsLimit: 256, PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '0' }] } });
  expect(container.pull.shouldPull()).toBe('never'); expect(container.startup).toBe(60000);
  expect(execute.mock.calls.at(-1)[1]).toEqual(['ps', '-aq', '--filter', 'id=owned-id']);
  expect(stopped).toHaveBeenCalledTimes(1);
});
test.each([['--database=live'], ['--size=999999']])('connection/size overrides rejected before Docker: %s', async arg => {
  await expect(runDescriptionCorpusProfile([arg])).rejects.toThrow('accepts_no_arguments');
  expect(execute).not.toHaveBeenCalled(); expect(lifecycle).not.toHaveBeenCalled();
});
test('bad image IDs rejected before start', async () => {
  execute.mockResolvedValueOnce({ stdout: 'tag' });
  await expect(runDescriptionCorpusProfile([])).rejects.toThrow('image_invalid');
  expect(lifecycle).not.toHaveBeenCalled();
});
test.each(['remote', 'memory'])('actual %s boundary failure stops before measurements', async kind => {
  if (kind === 'remote') host = '10.0.0.1'; else actualMemory = 0;
  await expect(runDescriptionCorpusProfile([])).rejects.toThrow('limits_invalid');
  expect(stopped).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls.at(-1)[1][0]).toBe('ps');
});
test('failed measurement still checks owned container removal', async () => {
  failure = new Error('measurement_failed');
  await expect(runDescriptionCorpusProfile([])).rejects.toBe(failure);
  expect(stopped).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls.at(-1)[1][0]).toBe('ps');
});
test('retained container cannot produce a successful report', async () => {
  remaining = 'owned-id';
  await expect(runDescriptionCorpusProfile([])).rejects.toThrow('container_cleanup_failed');
});
