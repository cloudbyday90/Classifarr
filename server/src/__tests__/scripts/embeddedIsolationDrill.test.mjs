/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { parseEmbeddedIsolationArguments, runEmbeddedIsolationCompose } from '../../../../scripts/lib/embeddedIsolationCompose.mjs';
import { assertDrillEnvironment, assertContainerLayout, assertProbeEnvironment, childEnvironment, HBA, IDENT } from '../../scripts/embeddedIsolationDrill/contract.mjs';
import { stopRuntime, waitForRuntime } from '../../scripts/embeddedIsolationDrill/processes.mjs';

const random = size => Buffer.alloc(size, 9);
const success = () => ({ status: 0, stdout: '' });
const config = readFileSync(new URL('../../../../docker-compose.embedded-isolation-drill.yml', import.meta.url), 'utf8');
const image = `sha256:${'a'.repeat(64)}`;
const imageRun = (_cmd, args) => args[0] === 'image' && args[1] === 'inspect'
  ? { status: 0, stdout: args.at(-1) === '{{.Id}}' ? image : JSON.stringify({ Id: image, RepoTags: ['caller:latest'] }) }
  : success();
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('immutable image mode reuses all four aliases, never builds or removes the caller image ID', () => {
  const run = jest.fn(imageRun);
  expect(runEmbeddedIsolationCompose({ image, run, random, verify: () => {} })).toEqual({ status: 'passed', cleanup: 'passed', image });
  expect(run.mock.calls.filter(([, args]) => args[0] === 'tag')).toHaveLength(4);
  expect(run.mock.calls.some(([, args]) => args.includes('build'))).toBe(false);
  const launch = run.mock.calls.find(([, args]) => args[7] === 'run')[1];
  expect(launch).toEqual(expect.arrayContaining(['--no-build', '--pull', 'never']));
  expect(run.mock.calls.some(([, args]) => args.includes('rm') && args.includes(image))).toBe(false);
  expect(run.mock.calls.at(-1)[1]).toEqual(['image', 'inspect', image, '--format', '{{.Id}}']);
});

test.each(['mutable-tag', 'missing', 'untagged', 'wrong-id', 'bad-json'])('rejects %s image before acquiring mutation ownership', scenario => {
  const run = jest.fn((_cmd, args) => args[0] !== 'image' || args[1] !== 'inspect' ? success()
    : scenario === 'missing' ? { status: 1 }
      : { status: 0, stdout: scenario === 'bad-json' ? 'no' : JSON.stringify({
        Id: scenario === 'wrong-id' ? 'other' : image, RepoTags: scenario === 'untagged' ? [] : ['caller:latest'],
      }) });
  expect(() => runEmbeddedIsolationCompose({ image: scenario === 'mutable-tag' ? 'latest' : image, run, random })).toThrow();
  expect(run.mock.calls.some(([, args]) => args[0] === 'tag' || args[0] === 'compose')).toBe(false);
});

test('partial alias setup still cleans only the owned project', () => {
  const run = jest.fn((cmd, args) => args[0] === 'tag' && args[2].includes('-custom:') ? { status: 1 } : imageRun(cmd, args));
  expect(() => runEmbeddedIsolationCompose({ image, run, random })).toThrow('drill_image_failed');
  expect(run.mock.calls.findLast(([, args]) => args[0] === 'compose')[1][7]).toBe('down');
});

test('CLI accepts no args or an immutable ID only', () => {
  expect(parseEmbeddedIsolationArguments([])).toEqual({});
  expect(parseEmbeddedIsolationArguments(['--image', image])).toEqual({ image });
  for (const args of [['--image'], ['--image', 'latest'], ['--image', image, 'extra'], ['--live']]) {
    expect(() => parseEmbeddedIsolationArguments(args)).toThrow('invalid_arguments');
  }
});

test('launcher builds and cleans only its isolated project, excluding ambient Compose overrides', () => {
  const old = process.env.COMPOSE_FILE;
  process.env.COMPOSE_FILE = 'live.yml';
  try {
    const run = jest.fn(success);
    const verify = jest.fn();
    expect(runEmbeddedIsolationCompose({ run, random, verify })).toEqual({ status: 'passed', cleanup: 'passed' });
    expect(verify).toHaveBeenCalledTimes(1);
    const compose = run.mock.calls.filter(([, args]) => args[0] === 'compose');
    expect(compose.map(([, args]) => args[7])).toEqual(['config', 'build', 'run', 'down']);
    for (const [command, args, options] of run.mock.calls) {
      expect(command).toBe('docker');
      expect(options.shell).toBe(false);
      expect(options.windowsHide).toBe(true);
      expect(options.env.COMPOSE_FILE).toBeUndefined();
      expect(options.env.COMPOSE_DISABLE_ENV_FILE).toBe('1');
      expect(args.join(' ')).not.toContain('live.yml');
    }
    expect(compose.at(-1)[1]).toEqual(expect.arrayContaining(['--volumes', '--rmi', 'local']));
  } finally {
    if (old === undefined) delete process.env.COMPOSE_FILE;
    else process.env.COMPOSE_FILE = old;
  }
});

test.each(['ps', 'volume', 'network', 'image'])('collision in %s prevents all mutation and cleanup', kind => {
  const run = jest.fn((_cmd, args) => ({ status: 0, stdout: args[0] === kind ? 'existing' : '' }));
  expect(() => runEmbeddedIsolationCompose({ run, random })).toThrow('drill_project_not_empty');
  expect(run.mock.calls.some(([, args]) => args[0] === 'compose')).toBe(false);
});

test.each([{ status: 1 }, { status: 0, stdout: '', error: new Error('timeout') }, { status: 0 }])(
  'failed inventory is not permission to clean resources: %j', result => {
    const run = jest.fn(() => result);
    expect(() => runEmbeddedIsolationCompose({ run, random })).toThrow('drill_inventory_failed');
    expect(run).toHaveBeenCalledTimes(1);
  });

test.each(['build', 'run'])('%s failure still cleans its own project but never passes', operation => {
  const run = jest.fn((_cmd, args) => args[7] === operation ? { status: 1 } : success());
  expect(() => runEmbeddedIsolationCompose({ run, random })).toThrow(`drill_${operation}_failed`);
  expect(run.mock.calls.findLast(([, args]) => args[0] === 'compose')[1][7]).toBe('down');
});

test('leftover owned resources make cleanup fail even when Compose reports success', () => {
  let stopped = false;
  const run = jest.fn((_cmd, args) => {
    if (args[7] === 'down') stopped = true;
    return { status: 0, stdout: stopped && args[0] === 'volume' ? 'leftover' : '' };
  });
  expect(() => runEmbeddedIsolationCompose({ run, random, verify: () => {} })).toThrow('drill_cleanup_failed:');
});

test('cleanup failure identifies the exact orphaned project and is fatal', () => {
  const run = jest.fn((_cmd, args) => args[7] === 'down' ? { status: 1 } : success());
  expect(() => runEmbeddedIsolationCompose({ run, random, verify: () => {} })).toThrow('drill_cleanup_failed:classifarr-isolation-drill-09090909');
});

test('invalid identity and config failures never acquire cleanup ownership', () => {
  const run = jest.fn(success);
  expect(() => runEmbeddedIsolationCompose({ run, random: () => 'bad' })).toThrow('invalid_drill_identity');
  expect(run).not.toHaveBeenCalled();
  run.mockImplementation((_cmd, args) => args[7] === 'config' ? { status: 1 } : success());
  expect(() => runEmbeddedIsolationCompose({ run, random })).toThrow('drill_config_failed');
  expect(run.mock.calls.at(-1)[1][7]).toBe('config');
});

test('Compose confines the drill to scratch volumes, no network, ports, secrets or bind mounts', () => {
  for (const value of ['read_only: true', 'network_mode: none', 'cap_drop: [ALL]',
    'no-new-privileges:true', 'mem_limit: 2g', 'cpus: 2', 'pids_limit: 128',
    '- rehearsal-state:/rehearsal', '- app-data:/app/data', 'stop_grace_period: 45s']) expect(config).toContain(value);
  expect(config).not.toMatch(/\$\{|env_file:|ports:|privileged:|docker.sock|\.\/data|\/data\/media/);
});

test('only explicit Linux root drill mode is accepted', () => {
  const environment = { CLASSIFARR_EMBEDDED_ISOLATION_DRILL: 'disposable-v1' };
  expect(() => assertDrillEnvironment(environment, { uid: 0, platform: 'linux' })).not.toThrow();
  for (const identity of [{ uid: 1000, platform: 'linux' }, { uid: 0, platform: 'win32' }]) {
    expect(() => assertDrillEnvironment(environment, identity)).toThrow('disposable_root_container_required');
  }
  expect(() => assertDrillEnvironment({}, { uid: 0, platform: 'linux' })).toThrow();
});

test('container guard refuses writable root, missing scratch mounts and external interfaces', () => {
  const mounts = ['/', '/rehearsal', '/app/data', '/run/postgresql'].map(path => `1 2 3 4 ${path} ro - overlay overlay ro`).join('\n');
  expect(() => assertContainerLayout(mounts, ['lo'])).not.toThrow();
  expect(() => assertContainerLayout(mounts.replace('/ ro', '/ rw'), ['lo'])).toThrow();
  expect(() => assertContainerLayout('', ['lo'])).toThrow();
  expect(() => assertContainerLayout(mounts, ['lo', 'eth0'])).toThrow();
});

test('whitelisted child environment separates maintenance and runtime without secrets', () => {
  expect(childEnvironment()).toMatchObject({ POSTGRES_USER: 'cf_runtime', CLASSIFARR_SCHEMA_MAINTENANCE: 'external' });
  expect(childEnvironment({ admin: true, restored: true })).toMatchObject({ POSTGRES_USER: 'classifarr', POSTGRES_DB: 'classifarr_isolation_restore' });
  expect(childEnvironment()).not.toHaveProperty('POSTGRES_PASSWORD');
  expect(HBA).not.toMatch(/trust|scram|password/);
  expect(HBA).toContain('local all all reject');
  expect(IDENT).toContain('maintenance postgres classifarr');
  expect(IDENT).toContain('runtime classifarr cf_runtime');
});

test.each([{}, { restored: true }, { admin: true, restored: true }])('probe never mutates ordinary runtime environments: %j', options => {
  const env = childEnvironment(options);
  const identity = { uid: options.admin ? 70 : 1000, platform: 'linux' };
  expect(() => assertProbeEnvironment(env, identity, options)).not.toThrow();
  for (const key of ['CLASSIFARR_EMBEDDED_ISOLATION_DRILL', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
    'POSTGRES_USER', 'CLASSIFARR_SCHEMA_MAINTENANCE', 'MIGRATIONS_DIR']) {
    expect(() => assertProbeEnvironment({ ...env, [key]: 'live' }, identity, options)).toThrow('isolated_probe_environment_required');
  }
  for (const other of [{ uid: 0, platform: 'linux' }, { uid: undefined, platform: 'win32' },
    { uid: options.admin ? 1000 : 70, platform: 'linux' }]) {
    expect(() => assertProbeEnvironment(env, other, options)).toThrow();
  }
});

test('runtime stops only after clean exit; abnormal exit cannot pass', async () => {
  await expect(stopRuntime(null)).resolves.toBeUndefined();
  const child = { kill: jest.fn() };
  await stopRuntime({ child, done: Promise.resolve({ code: 0, signal: null }) });
  expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  for (const result of [{ code: 1, signal: null }, { code: null, signal: 'SIGKILL' }]) {
    await expect(stopRuntime({ child, done: Promise.resolve(result) })).rejects.toThrow('runtime_shutdown_failed');
  }
});

test('shutdown deadline kills and joins the exact child without reporting success', async () => {
  jest.useFakeTimers();
  let resolveExit;
  const done = new Promise(resolve => { resolveExit = resolve; });
  const child = { kill: jest.fn(signal => { if (signal === 'SIGKILL') resolveExit({ code: null, signal }); }) };
  const outcome = expect(stopRuntime({ child, done }, 100)).rejects.toThrow('runtime_shutdown_timeout');
  await jest.advanceTimersByTimeAsync(100);
  await outcome;
  expect(child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
});

test('readiness requires connected database and refuses an exited process or timeout', async () => {
  const child = { exitCode: null, signalCode: null };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ database: 'connected' }) });
  await expect(waitForRuntime({ child })).resolves.toBeUndefined();
  await expect(waitForRuntime({ child: { exitCode: 1 } })).rejects.toThrow('runtime_exited_before_ready');
  await expect(waitForRuntime({ child }, 0)).rejects.toThrow('runtime_readiness_timeout');
});
