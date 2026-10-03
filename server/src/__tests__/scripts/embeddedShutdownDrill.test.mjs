/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { SHUTDOWN_CASES, checkLoadedShutdown, runLoadedShutdownDrill } from '../../../../scripts/lib/embeddedShutdownChecks.mjs';
import { withShutdownContainer } from '../../../../scripts/lib/embeddedShutdownDocker.mjs';

function context(scenario) {
  let stopped = 0;
  const log = '{"component":"EmbeddedQueueMaintenance","status":"assessment_started"}\n'
    + '{"component":"EmbeddedQueueMaintenance","status":"unavailable"}\n'
    + (scenario.clean ? '{"status":"application_stopped"}\n{"status":"database_stopped"}' : '');
  return {
    name: 'fixture', image: 'sha256:fixture',
    docker: jest.fn(async args => {
      if (args[0] === 'stop') stopped += 1;
      if (args[0] === 'logs') return log;
      if (args.includes('cat')) return scenario.clean ? 'ready' : 'automatic recovery in progress';
      if (args.includes('ps')) return 'node /app/src/index.mjs';
      return '';
    }),
    inspect: jest.fn(async () => ({ Status: 'exited', OOMKilled: false, ExitCode: stopped > 1 ? 0 : scenario.exit })),
    query: jest.fn(async text => text.startsWith('SELECT value') ? 'preserved' : text.startsWith('SELECT') ? '0' : ''),
    healthy: jest.fn(),
    readReceipt: jest.fn(async kind => JSON.stringify(kind === 'ready'
      ? { mode: scenario.mode, application: 10, worker: 11, httpBlocked: true, assessmentBlocked: true, uncommitted: true }
      : { status: 200, completedAfterSignal: true })),
    waitFor: check => check(),
    offline: jest.fn(async () => `Database cluster state: ${scenario.clean ? 'shut down' : 'in production'}\n`),
  };
}

test.each(SHUTDOWN_CASES)('requires actual stop/restart evidence for $mode/$seconds', async scenario => {
  const f = context(scenario);
  await expect(checkLoadedShutdown(f, scenario)).resolves.toMatchObject({ exitCode: scenario.exit, dataPreserved: true });
  expect(f.docker).toHaveBeenCalledWith(['stop', '--timeout', String(scenario.seconds), 'fixture'], (scenario.seconds + 10) * 1000);
  expect(f.offline).toHaveBeenCalledTimes(1);
  expect(f.healthy).toHaveBeenCalledTimes(1);
  expect(f.query).toHaveBeenCalledWith('SELECT attempts FROM queue_vacuum_recovery_state WHERE singleton');
});

test.each(['fixture', 'inflight', 'pid', 'exit', 'oom', 'order', 'control', 'data', 'attempt', 'recovery', 'http', 'worker', 'final-stop'])
('refuses incomplete or contradictory %s evidence', async failure => {
  const scenario = SHUTDOWN_CASES[0], f = context(scenario);
  if (failure === 'fixture') f.readReceipt.mockResolvedValue('{"phase":"assessment_wait"}');
  if (failure === 'inflight') f.readReceipt.mockResolvedValue(JSON.stringify({ mode: 'drain', httpBlocked: false }));
  if (failure === 'pid') f.readReceipt.mockResolvedValue(JSON.stringify({ mode: 'drain', httpBlocked: true, assessmentBlocked: true, uncommitted: true, application: 0 }));
  if (failure === 'exit') f.inspect.mockResolvedValue({ Status: 'exited', OOMKilled: false, ExitCode: 137 });
  if (failure === 'oom') f.inspect.mockResolvedValue({ Status: 'exited', OOMKilled: true, ExitCode: 0 });
  if (failure === 'control') f.offline.mockResolvedValue('Database cluster state: in production\n');
  if (failure === 'data') f.query.mockResolvedValue('lost');
  if (failure === 'attempt') f.query.mockImplementation(async text => text.includes('attempts') ? '1' : text.startsWith('SELECT value') ? 'preserved' : '0');
  if (failure === 'http') f.readReceipt.mockImplementation(async kind => kind === 'http' ? '{"phase":"drain"}' : context(scenario).readReceipt(kind));
  if (failure === 'final-stop') f.inspect.mockResolvedValueOnce({ Status: 'exited', OOMKilled: false, ExitCode: 0 }).mockResolvedValue({ ExitCode: 1 });
  if (['order', 'recovery', 'worker'].includes(failure)) {
    const original = f.docker.getMockImplementation();
    f.docker.mockImplementation(args => {
      if (failure === 'order' && args[0] === 'logs') return '{"component":"EmbeddedQueueMaintenance","status":"assessment_started"}\n{"status":"database_stopped"}';
      if (failure === 'recovery' && args.includes('cat')) return 'automatic recovery in progress';
      if (failure === 'worker' && args.includes('ps')) return 'node /app/src/scripts/runCompatibleQueueRecovery.mjs';
      return original(args);
    });
  }
  await expect(checkLoadedShutdown(f, scenario)).rejects.toThrow();
});

test('does not accept a clean-stop claim after a forced host kill', async () => {
  const scenario = SHUTDOWN_CASES[2], f = context(scenario);
  f.docker.mockResolvedValue('{"component":"EmbeddedQueueMaintenance","status":"assessment_started"}\n{"status":"database_stopped"}');
  await expect(checkLoadedShutdown(f, scenario)).rejects.toThrow();
});

test('runs sequentially and reports only after container verification and cleanup', async () => {
  let index = 0;
  const report = jest.fn();
  const container = jest.fn(check => check(context(SHUTDOWN_CASES[index++])));
  expect(await runLoadedShutdownDrill({ container, report })).toHaveLength(4);
  expect(report).toHaveBeenCalledTimes(4);
  expect(container.mock.calls[1][1]).toEqual({ imageName: 'sha256:fixture' });
  await expect(runLoadedShutdownDrill({ container: async () => { throw new Error('cleanup_failed'); }, report })).rejects.toThrow('cleanup_failed');
  expect(report).toHaveBeenCalledTimes(4);
});

test('refuses evidence from different images within a rehearsal', async () => {
  let index = 0;
  const container = async check => {
    const f = context(SHUTDOWN_CASES[index]); f.image = `image-${index++}`;
    return check(f);
  };
  await expect(runLoadedShutdownDrill({ container, report: jest.fn() })).rejects.toThrow('shutdown_drill_image_changed');
});

function dockerFixture({ collision = false, cleanupFailure = false } = {}) {
  const suffix = '09'.repeat(16), name = `classifarr-stop-drill-${suffix}`;
  let created = false;
  const execute = jest.fn(async (_command, args) => {
    if (args[0] === 'image') return { stdout: `sha256:${'a'.repeat(64)}` };
    if (args[0] === 'inspect') return { stdout: '{"Running":true,"Health":{"Status":"healthy"}}' };
    if (args[0] === 'create') created = true;
    if (args[0] === 'ps') return { stdout: collision ? 'occupied' : created && !args.some(arg => arg.includes('-offline')) ? 'owned' : '' };
    if (args[0] === 'volume' && args[1] === 'ls') return { stdout: created ? `${name}-data` : '' };
    if (cleanupFailure && args[0] === 'rm') throw new Error('cleanup refused');
    return { stdout: '' };
  });
  return { execute, random: size => Buffer.alloc(size, 9), imageName: 'classifarr:test', name };
}

test('pins the image, isolates resources, preserves entrypoint and bounds every command', async () => {
  const f = dockerFixture();
  await withShutdownContainer(async context => { await context.offline(); return 'passed'; }, f);
  const calls = f.execute.mock.calls;
  const create = calls.find(([, args]) => args[0] === 'create')[1];
  expect(create).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--user', '1000:1000', '--cap-drop', 'ALL']));
  expect(create).not.toContain('--entrypoint');
  expect(create.at(-1)).toBe(`sha256:${'a'.repeat(64)}`);
  expect(create).not.toContain('--privileged');
  expect(create.join(' ')).not.toContain('docker.sock');
  expect(calls.every(([, , options]) => options.shell === false && options.timeout > 0 && options.maxBuffer > 0)).toBe(true);
  expect(calls.some(([, args]) => args[0] === 'rm' && args.at(-1) === f.name)).toBe(true);
  expect(calls.at(-1)[1]).toEqual(['volume', 'rm', `${f.name}-data`]);
});

test('cleans after verification failure but never touches a name collision', async () => {
  const f = dockerFixture();
  await expect(withShutdownContainer(() => { throw new Error('verification'); }, f)).rejects.toThrow('verification');
  expect(f.execute.mock.calls.at(-1)[1][1]).toBe('rm');
  const occupied = dockerFixture({ collision: true });
  await expect(withShutdownContainer(jest.fn(), occupied)).rejects.toThrow('collision');
  expect(occupied.execute.mock.calls.some(([, args]) => ['rm', 'create'].includes(args[0]))).toBe(false);
});

test('fails cleanup explicitly and retains the original verification failure', async () => {
  const f = dockerFixture({ cleanupFailure: true });
  let failure;
  try { await withShutdownContainer(() => { throw new Error('verification'); }, f); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.message).toContain(`cleanup_failed:${f.name}`);
  expect(failure.errors[0].message).toBe('verification');
});

test.each(['--invalid', '', 'image;command'])('rejects invalid image input %s before Docker', async imageName => {
  const f = dockerFixture();
  await expect(withShutdownContainer(jest.fn(), { ...f, imageName })).rejects.toThrow();
  expect(f.execute).not.toHaveBeenCalled();
});
