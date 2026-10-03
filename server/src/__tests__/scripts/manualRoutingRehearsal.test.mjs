/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { withRoutingRehearsal, routingReceipt, ROUTING_BASELINE } from '../../../../scripts/lib/manualRoutingRehearsalDocker.mjs';
import { providerHandler } from '../../../../scripts/fixtures/manualRoutingRehearsal/provider.mjs';
import { assertFixtureEnvironment } from '../../../../scripts/fixtures/manualRoutingRehearsal/support.mjs';
import { runManualRoutingRehearsal, ROUTING_EXPECTED } from '../../../../scripts/lib/manualRoutingRehearsal.mjs';

function dockerFixture({ collision, failure, wrongRevision = false, cleanupFailure = false, foreignLabel = false } = {}) {
  const baseline = `sha256:${'a'.repeat(64)}`, candidate = `sha256:${'b'.repeat(64)}`;
  const name = `classifarr-routing-drill-${'09'.repeat(16)}`;
  let container = false, volume = false;
  const execute = jest.fn(async (_binary, args) => {
    if (args[0] === 'image') return { stdout: args.includes('{{.Id}}') ? args.at(-1) : wrongRevision ? 'different' : ROUTING_BASELINE };
    if (args[0] === 'ps') return { stdout: container
      ? foreignLabel && args.some(arg => arg.startsWith('label=')) ? '' : 'owned'
      : collision === 'container' ? 'occupied' : '' };
    if (args[0] === 'inspect') return { stdout: '{"Running":true,"Health":{"Status":"healthy"}}' };
    if (args[0] === 'volume') {
      if (args[1] === 'ls') return { stdout: volume ? `${name}-data` : collision === 'volume' ? 'occupied' : '' };
      if (args[1] === 'create') volume = true;
      if (args[1] === 'rm') volume = false;
    }
    if (args[0] === 'create') container = true;
    if (args[0] === 'rm') { if (cleanupFailure) throw new Error('sensitive output'); container = false; }
    if (args[0] === failure) throw Object.assign(new Error('secret'), { stderr: 'secret credential' });
    return { stdout: '' };
  });
  return { baseline, candidate, name, execute, random: size => Buffer.alloc(size, 9) };
}

test.each(['classifarr:latest', '', 'sha256:bad', '--privileged'])('rejects mutable or malformed candidate %s', async candidate => {
  const f = dockerFixture();
  await expect(withRoutingRehearsal({ ...f, candidate }, jest.fn())).rejects.toThrow();
  expect(f.execute).not.toHaveBeenCalled();
});
test('rejects same-image restart disguised as upgrade', async () => {
  const f = dockerFixture();
  await expect(withRoutingRehearsal({ ...f, candidate: f.baseline }, jest.fn())).rejects.toThrow('distinct');
  expect(f.execute).not.toHaveBeenCalled();
});
test.each(['container', 'volume'])('does not create or delete anything on %s collision', async collision => {
  const f = dockerFixture({ collision });
  await expect(withRoutingRehearsal(f, jest.fn())).rejects.toThrow('collision');
  expect(f.execute.mock.calls.some(([, args]) => args.includes('create') || args.includes('rm'))).toBe(false);
});
test('requires the pinned prior revision before creating a volume', async () => {
  const f = dockerFixture({ wrongRevision: true });
  await expect(withRoutingRehearsal(f, jest.fn())).rejects.toThrow();
  expect(f.execute.mock.calls.some(([, args]) => args.includes('create'))).toBe(false);
});
test('uses unchanged production entrypoint, no network or host data and bounded commands', async () => {
  const f = dockerFixture();
  await expect(withRoutingRehearsal(f, async ctx => { await ctx.start(f.baseline); return { status: 'passed' }; }))
    .resolves.toEqual({ status: 'passed', cleanup: 'passed' });
  const args = f.execute.mock.calls.find(([, args]) => args[0] === 'create')[1];
  expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--memory', '2g', '--cpus', '2', '--pids-limit', '128', '--user', '1000:1000']));
  expect(args).not.toContain('--entrypoint'); expect(args).not.toContain('--publish');
  expect(args.join(' ')).not.toMatch(/docker\.sock|--privileged|--import/);
  expect(f.execute.mock.calls.every(([, , options]) => options.shell === false && options.timeout > 0 && options.maxBuffer > 0)).toBe(true);
  const removal = f.execute.mock.calls.findIndex(([, args]) => args[0] === 'rm');
  expect(f.execute.mock.calls[removal - 1][1]).toContain(`label=classifarr.routing-drill=${'09'.repeat(16)}`);
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'image' && args[1] === 'rm')).toBe(false);
});
test('cleans owned resources after ambiguous create failure and suppresses subprocess secrets', async () => {
  const f = dockerFixture({ failure: 'create' });
  await expect(withRoutingRehearsal(f, ctx => ctx.start(f.baseline))).rejects.toThrow('routing_docker_failed:create');
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'rm')).toBe(true);
  expect(f.execute.mock.calls.some(([, args]) => args[0] === 'volume' && args[1] === 'rm')).toBe(true);
});
test('never reports success if cleanup failed', async () => {
  const f = dockerFixture({ cleanupFailure: true });
  await expect(withRoutingRehearsal(f, async ctx => { await ctx.start(f.baseline); return { status: 'passed' }; }))
    .rejects.toThrow(`routing_cleanup_failed:${f.name}`);
});
test('refuses deletion and reports incomplete cleanup if the ownership label no longer matches', async () => {
  const f = dockerFixture({ foreignLabel: true });
  await expect(withRoutingRehearsal(f, async ctx => { await ctx.start(f.baseline); return { status: 'passed' }; }))
    .rejects.toThrow(`routing_cleanup_failed:${f.name}`);
  expect(f.execute.mock.calls.some(([, args]) => args.includes('rm'))).toBe(false);
});
test('rejects absent, duplicate and malformed receipts', () => {
  expect(routingReceipt('noise\nROUTING_PROBE {"ready":true}\n')).toEqual({ ready: true });
  for (const text of ['', 'ROUTING_PROBE {}\nROUTING_PROBE {}', 'ROUTING_PROBE bad']) expect(() => routingReceipt(text)).toThrow();
});
test('fixture refuses an ordinary production environment', () => {
  expect(() => assertFixtureEnvironment({})).toThrow();
  expect(() => assertFixtureEnvironment({ CLASSIFARR_ROUTING_REHEARSAL: 'disposable-v1', POSTGRES_HOST: 'live' })).toThrow();
});
test.each(['POST', 'PUT', 'DELETE'])('provider records and refuses every %s', method => {
  const requests = { writes: 0, unexpected: 0, movie: 0, tv: 0 };
  const handler = providerHandler({ read: () => requests, write: jest.fn() });
  const res = { writeHead: jest.fn(), end: jest.fn() };
  handler({ method, url: '/radarr/api/v3/movie', headers: {} }, res);
  expect(requests.writes).toBe(1); expect(res.writeHead).toHaveBeenCalledWith(405);
});
test('persists a held arrival before returning without a response', () => {
  const requests = { writes: 0, unexpected: 0, movie: 0, tv: 0 }, write = jest.fn();
  const handler = providerHandler({ read: name => name === 'requests' ? requests : { movie: 'hold' }, write, now: () => 42 });
  const res = { writeHead: jest.fn(), end: jest.fn() };
  handler({ method: 'GET', url: '/radarr/api/v3/movie?tmdbId=42', headers: {} }, res);
  expect(write).toHaveBeenCalledWith('requests', expect.objectContaining({ movie: 1, heldAt: 42 }));
  expect(res.end).not.toHaveBeenCalled();
});
test('requires repaired credentials and returns exact identity/path on success', () => {
  const requests = { writes: 0, unexpected: 0, movie: 0, tv: 0 };
  const handler = providerHandler({ read: name => name === 'requests' ? requests : { tv: 'present' }, write: jest.fn() });
  const denied = { writeHead: jest.fn(), end: jest.fn() }, accepted = { writeHead: jest.fn(), end: jest.fn() };
  handler({ method: 'GET', url: '/sonarr/api/v3/series?tvdbId=42', headers: {} }, denied);
  expect(denied.writeHead.mock.calls[0][0]).toBe(401);
  handler({ method: 'GET', url: '/sonarr/api/v3/series?tvdbId=42', headers: { 'x-api-key': 'rotated-synthetic' } }, accepted);
  expect(JSON.parse(accepted.end.mock.calls[0][0])).toEqual([{ id: 7, tvdbId: 42, path: '/tv/Synthetic' }]);
  expect(requests.tv).toBe(2); expect(requests.writes).toBe(0);
});

function scenario() {
  let killed = false;
  return { name: 'fixture', baseline: 'old', candidate: 'new',
    start: jest.fn(), healthy: jest.fn(), removeContainer: jest.fn(), provider: jest.fn(),
    docker: jest.fn(async args => { if (args[0] === 'kill') killed = true; if (args[0] === 'stop') killed = false; }),
    inspect: jest.fn(async () => ({ OOMKilled: false, ExitCode: killed ? 137 : 0 })),
    waitFor: async check => { if (!(await check())) throw new Error('not_ready'); },
    probe: jest.fn(async phase => phase.endsWith('-ready') ? { ready: true } : JSON.parse(JSON.stringify(ROUTING_EXPECTED[phase]))),
  };
}
test('runs image replacement and actual interruption before accepting a complete receipt', async () => {
  const ctx = scenario(), report = jest.fn();
  const result = await runManualRoutingRehearsal({}, { container: (_, check) => check(ctx), report });
  expect(ctx.start.mock.calls).toEqual([['old'], ['new']]);
  expect(ctx.docker).toHaveBeenCalledWith(['kill', '--signal', 'SIGKILL', 'fixture'], 70_000);
  expect(ctx.probe.mock.calls.flat()).toEqual(['seed', 'upgraded', 'arm-crash', 'crash-ready', 'restarted',
    'movie-ready', 'exhausted', 'pause-ready', 'paused', 'repair', 'complete-ready', 'complete']);
  expect(result).toMatchObject({ status: 'passed', providerWrites: 0, movieGets: 2, tvGets: 2 });
});
test.each(['missing', 'writes', 'ready', 'oom', 'exit'])('rejects contradictory %s evidence', async failure => {
  const ctx = scenario(), original = ctx.probe.getMockImplementation();
  ctx.probe.mockImplementation(async phase => {
    if (phase === 'complete' && failure === 'missing') return {};
    if (phase === 'complete' && failure === 'writes') return { ...ROUTING_EXPECTED.complete, providerWrites: 1 };
    if (phase === 'crash-ready' && failure === 'ready') return { ready: 'true' };
    return original(phase);
  });
  if (failure === 'oom') ctx.inspect.mockResolvedValue({ OOMKilled: true, ExitCode: 0 });
  if (failure === 'exit') ctx.inspect.mockResolvedValue({ OOMKilled: false, ExitCode: 0 });
  await expect(runManualRoutingRehearsal({}, { container: (_, check) => check(ctx), report: jest.fn() })).rejects.toThrow();
});
