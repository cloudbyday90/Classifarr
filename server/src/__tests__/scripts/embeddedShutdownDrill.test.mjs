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
  expect(container.mock.calls[1][1]).toEqual({ scenario: 'drain-60', imageName: 'sha256:fixture' });
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
  let created = false, volumeCreated = false;
  const execute = jest.fn(async (_command, args) => {
    if (args[0] === 'image') return { stdout: `sha256:${'a'.repeat(64)}` };
    if (args[0] === 'inspect') return { stdout: '{"Running":true,"Health":{"Status":"healthy"}}' };
    if (args[0] === 'create') created = true;
    if (args[0] === 'volume' && args[1] === 'create') volumeCreated = true;
    if (args[0] === 'ps') return { stdout: collision ? 'occupied' : created && !args.some(arg => arg.includes('-offline')) ? 'owned' : '' };
    if (args[0] === 'volume' && args[1] === 'ls') return { stdout: volumeCreated ? `${name}-data` : '' };
    if (cleanupFailure && args[0] === 'rm') throw new Error('cleanup refused');
    if (args[0] === 'rm') created = false;
    if (args[0] === 'volume' && args[1] === 'rm') volumeCreated = false;
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
  expect(calls.at(-1)[1]).toEqual(['volume', 'ls', '-q', '--filter', `name=^${f.name}-data$`]);
});

test.each(['http', 'queue'])('selects only the fixed %s fixture preload', async fixtureMode => {
  const f = dockerFixture();
  await withShutdownContainer(async () => 'passed', { ...f, fixtureMode });
  const create = f.execute.mock.calls.find(([, args]) => args[0] === 'create')[1];
  expect(create).toContain(`NODE_OPTIONS=--max-old-space-size=1024 --import=/app/shutdown-fixture/${fixtureMode === 'queue' ? 'queue-preload' : 'preload'}.mjs`);
});

test('rejects unsupported fixture input before Docker', async () => {
  const f = dockerFixture();
  await expect(withShutdownContainer(jest.fn(), { ...f, fixtureMode: '../custom' })).rejects.toThrow('unsupported_shutdown_fixture');
  expect(f.execute).not.toHaveBeenCalled();
});

test('cleans after verification failure but never touches a name collision', async () => {
  const f = dockerFixture();
  await expect(withShutdownContainer(() => { throw new Error('verification'); }, f)).rejects.toThrow('verification');
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'volume' && args[1] === 'rm')).toBe(true);
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

test('retains original failure, cleanup command failure and absence verification separately', async () => {
  const f = dockerFixture({ cleanupFailure: true }), diagnostics = jest.fn();
  await expect(withShutdownContainer(() => { throw new Error('queue_claim_wait_failed:private'); }, { ...f, diagnostics }))
    .rejects.toThrow('shutdown_drill_cleanup_failed');
  const receipt = diagnostics.mock.calls.at(-1)[0];
  expect(receipt).toMatchObject({ status: 'failed', failurePhase: 'scenario', failure: { code: 'queue_claim_wait_failed' },
    cleanup: { status: 'failed', verification: expect.arrayContaining([{ resource: f.name, status: 'present' }]) } });
  expect(receipt.cleanup.errors[0]).toMatchObject({ resource: f.name, operation: 'remove',
    error: { command: { operation: 'rm', category: 'command_failed', timeoutMs: 30_000 } } });
  expect(JSON.stringify(receipt)).not.toMatch(/private|cleanup refused|NODE_OPTIONS|INSERT INTO/);
});

test('ambiguous removal timeout stays blocking even when absence is confirmed', async () => {
  const f = dockerFixture(), original = f.execute.getMockImplementation(), diagnostics = jest.fn();
  f.execute.mockImplementation(async (...args) => {
    const result = await original(...args);
    if (args[1][0] === 'rm') throw Object.assign(new Error('secret command'), { code: 'ETIMEDOUT', killed: true, signal: 'SIGTERM' });
    return result;
  });
  await expect(withShutdownContainer(async () => 'passed', { ...f, diagnostics })).rejects.toThrow('cleanup_failed');
  const receipt = diagnostics.mock.calls.at(-1)[0];
  expect(receipt.failure).toBeNull();
  expect(receipt.cleanup.verification.every(item => item.status === 'absent')).toBe(true);
  expect(receipt.cleanup.errors[0].error.command).toMatchObject({ category: 'command_timeout', systemCode: 'ETIMEDOUT', signal: 'SIGTERM' });
});

test.each(['present', 'verification-failed', 'unowned'])('does not pass cleanup after %s', async fault => {
  const f = dockerFixture(), original = f.execute.getMockImplementation(), diagnostics = jest.fn();
  let scenario = false;
  f.execute.mockImplementation(async (...args) => {
    const command = args[1];
    if (scenario && command[0] === 'ps' && command.includes(`name=^/${f.name}$`)) {
      if (command.some(arg => arg.startsWith('label='))) return { stdout: fault === 'unowned' ? '' : 'owned' };
      if (fault === 'verification-failed') throw new Error('daemon error private');
      return { stdout: 'still present' };
    }
    return original(...args);
  });
  await expect(withShutdownContainer(async () => { scenario = true; }, { ...f, diagnostics })).rejects.toThrow('cleanup_failed');
  const receipt = diagnostics.mock.calls.at(-1)[0];
  expect(receipt.cleanup.status).toBe('failed');
  expect(receipt.cleanup.verification).toContainEqual({ resource: f.name, status: fault === 'verification-failed' ? 'unknown' : 'present' });
  if (fault === 'unowned') expect(f.execute.mock.calls.some(([, args]) => args[0] === 'rm' && args.at(-1) === f.name)).toBe(false);
});

test('cleans a volume after container creation fails and reports setup as the failure phase', async () => {
  const f = dockerFixture(), original = f.execute.getMockImplementation(), diagnostics = jest.fn();
  f.execute.mockImplementation(async (...args) => {
    if (args[1][0] === 'create') throw new Error('create failed private');
    return original(...args);
  });
  await expect(withShutdownContainer(jest.fn(), { ...f, diagnostics })).rejects.toThrow('create failed');
  expect(diagnostics.mock.calls.at(-1)[0]).toMatchObject({ failurePhase: 'setup', cleanup: { status: 'passed' } });
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'volume' && args[1] === 'rm')).toBe(true);
});

test('diagnostic persistence failure cannot prevent cleanup or result in success', async () => {
  const f = dockerFixture();
  const diagnostics = jest.fn(receipt => { if (receipt.phase === 'scenario') throw new Error('disk full private'); });
  await expect(withShutdownContainer(jest.fn(), { ...f, diagnostics })).rejects.toThrow('cleanup_failed');
  expect(diagnostics.mock.calls.at(-1)[0]).toMatchObject({ status: 'failed', cleanup: { status: 'passed' } });
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'rm')).toBe(true);
});

test('bounds the operation tail and reports preflight collisions without cleanup', async () => {
  const f = dockerFixture(), diagnostics = jest.fn();
  await withShutdownContainer(async ({ docker, name }) => { for (let i = 0; i < 30; i++) await docker(['inspect', name]); }, { ...f, diagnostics });
  expect(diagnostics.mock.calls.at(-1)[0].operations).toHaveLength(20);
  diagnostics.mockClear();
  await expect(withShutdownContainer(jest.fn(), { ...dockerFixture({ collision: true }), diagnostics })).rejects.toThrow('collision');
  expect(diagnostics.mock.calls.at(-1)[0]).toMatchObject({ failurePhase: 'preflight', cleanup: { status: 'not_started' } });
});
