/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { inventoryBenchmarkComposePlan, BENCHMARK_HOST_RESERVE } from '../../../../scripts/lib/inventory-benchmark-compose.mjs';
import { runOwnedInventoryBenchmark } from '../../../../scripts/lib/inventory-benchmark-lifecycle.mjs';
import { createInventoryBenchmarkDocker } from '../../../../scripts/lib/inventory-benchmark-docker.mjs';

const runId = '12345678-1234-1234-1234-123456789abc';
const container = { image: `sha256:${'a'.repeat(64)}`, running: true, health: 'healthy', project: 'classifarr' };
const args = ['--seed', 'classifarr-test-20260920', '--folds', '5', '--leader-grounded'];
const plan = () => inventoryBenchmarkComposePlan(container, args, runId, BENCHMARK_HOST_RESERVE);
test('dedicated scorer flags are bounded and cannot accidentally enable chat generation', () => {
  const scorer = args.map(value => value === '--leader-grounded' ? '--leader-cross-encoder' : value);
  expect(inventoryBenchmarkComposePlan(container, [...scorer, '--score-cases', '100'], runId, BENCHMARK_HOST_RESERVE).args).toContain('--leader-cross-encoder');
  for (const extra of [['--score-cases', '101'], ['--generate-cases', '1'], ['--leader-semantic']]) {
    expect(() => inventoryBenchmarkComposePlan(container, [...scorer, ...extra], runId, BENCHMARK_HOST_RESERVE)).toThrow();
  }
  expect(() => inventoryBenchmarkComposePlan(container, [...args, '--score-cases', '0'], runId, BENCHMARK_HOST_RESERVE)).toThrow();
});
function docker() { return { start: jest.fn(async () => {}), wait: jest.fn(async () => 0), stop: jest.fn(async () => {}),
  remove: jest.fn(async () => {}), follow: jest.fn(() => ({ close: jest.fn(async () => {}) })) }; }

test('pins observed image and scopes a detached, no-pull, no-dependencies container', () => {
  const result = plan(); expect(result.image).toBe(container.image);
  expect(result.args).toEqual(['compose', '--project-name', 'classifarr', '-f', 'docker-compose.yml', '-f', 'docker-compose.benchmark.yml',
    'run', '--detach', '--no-deps', '--pull', 'never', '--name', result.name, '--label', `org.classifarr.benchmark-run=${runId}`,
    '--', 'inventory-benchmark', ...args, '--admission-wait-ms', '300000']);
  expect(result.timeoutMs).toBe(1_260_000);
});
test.each([{ health: 'starting' }, { running: false }, { image: 'latest' }, { project: '../unsafe' }])('fails closed on app state %j', override => {
  expect(() => inventoryBenchmarkComposePlan({ ...container, ...override }, args, runId, BENCHMARK_HOST_RESERVE)).toThrow();
});
test.each([0, BENCHMARK_HOST_RESERVE - 1, NaN, Infinity])('requires Docker host reserve %s', free => {
  expect(() => inventoryBenchmarkComposePlan(container, args, runId, free)).toThrow('memory_pressure');
});
test.each([['--volume', '/data'], ['--admission-wait-ms', '0'], ['--size', '301'], ['--generate-cases', '33'],
  ['--context', '42'], ['--max-minutes', '121'], ['--leader-semantic'], ['--seed', 'bad;seed'], ['--folds', '0']])('rejects invalid CLI %j', (...extra) => {
  expect(() => inventoryBenchmarkComposePlan(container, [...args, ...extra], runId, BENCHMARK_HOST_RESERVE)).toThrow();
});
test('validates excluded cohorts and zero-generation challenge consistently with backend', () => {
  expect(inventoryBenchmarkComposePlan(container, [...args, '--exclude-prior-sizes', '100,200', '--max-minutes', '1'], runId, BENCHMARK_HOST_RESERVE).timeoutMs).toBe(120000);
  expect(() => inventoryBenchmarkComposePlan(container, [...args, '--exclude-prior-sizes', 'bad'], runId, BENCHMARK_HOST_RESERVE)).toThrow();
  const challenge = args.map(value => value === '--leader-grounded' ? '--leader-challenge' : value);
  expect(inventoryBenchmarkComposePlan(container, challenge, runId, BENCHMARK_HOST_RESERVE).args).toContain('--leader-challenge');
  expect(() => inventoryBenchmarkComposePlan(container, [...challenge, '--generate-cases', '1'], runId, BENCHMARK_HOST_RESERVE)).toThrow();
});
test.each(['main', '------------------------------------'])('rejects non-UUID ownership %s', id => {
  expect(() => inventoryBenchmarkComposePlan(container, args, id, BENCHMARK_HOST_RESERVE)).toThrow();
});
test.each([0, 1, 137])('propagates exit %s and cleans only after work settles', async code => {
  const runtime = docker(); runtime.wait.mockResolvedValue(code);
  expect(await runOwnedInventoryBenchmark(plan(), runtime)).toBe(code);
  expect(runtime.remove).toHaveBeenCalledTimes(1); expect(runtime.stop).not.toHaveBeenCalled();
  expect(runtime.follow.mock.results[0].value.close).toHaveBeenCalledTimes(1);
});
test.each(['start', 'wait', 'follow'])('cleans after %s failure', async method => {
  const runtime = docker(); runtime[method].mockImplementation(() => { throw new Error('failed'); });
  await expect(runOwnedInventoryBenchmark(plan(), runtime)).rejects.toThrow('failed');
  expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test('does not hide cleanup failure or claim success', async () => {
  const runtime = docker(); runtime.remove.mockRejectedValue(new Error('daemon offline'));
  await expect(runOwnedInventoryBenchmark(plan(), runtime)).rejects.toThrow(`inventory_benchmark_cleanup_failed:${plan().name}`);
});
test('abort before startup never starts a job', async () => {
  const runtime = docker(); expect(await runOwnedInventoryBenchmark(plan(), runtime, { signal: AbortSignal.abort() })).toBe(130);
  expect(runtime.start).not.toHaveBeenCalled(); expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test('cancellation during startup is remembered; created container is stopped and removed', async () => {
  const controller = new AbortController(), runtime = docker();
  runtime.start.mockImplementation(async () => { controller.abort(); });
  expect(await runOwnedInventoryBenchmark(plan(), runtime, { signal: controller.signal })).toBe(130);
  expect(runtime.stop).toHaveBeenCalledTimes(1); expect(runtime.follow).not.toHaveBeenCalled(); expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test('cancellation during wait stops once, cancels monitoring, and cleans even if stop fails', async () => {
  const controller = new AbortController(), runtime = docker();
  runtime.stop.mockRejectedValue(new Error('stop failed'));
  runtime.wait.mockImplementation(async signal => { controller.abort(); signal.throwIfAborted(); });
  expect(await runOwnedInventoryBenchmark(plan(), runtime, { signal: controller.signal })).toBe(130);
  expect(runtime.stop).toHaveBeenCalledTimes(1); expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test('external runtime deadline cancels the monitor and removes the job', async () => {
  const runtime = docker();
  runtime.wait.mockImplementation(signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  expect(await runOwnedInventoryBenchmark({ ...plan(), timeoutMs: 10 }, runtime)).toBe(124);
  expect(runtime.stop).toHaveBeenCalledTimes(1); expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test.each([NaN, -1, 256, '0'])('rejects malformed exit %s', async code => {
  const runtime = docker(); runtime.wait.mockResolvedValue(code);
  await expect(runOwnedInventoryBenchmark(plan(), runtime)).rejects.toThrow('exit_invalid');
});
test('Docker removal verifies UUID label and exact container ID, then absence', async () => {
  const id = 'b'.repeat(64), execute = jest.fn();
  for (const stdout of [id, runId, id, '']) execute.mockResolvedValueOnce({ stdout });
  const adapter = createInventoryBenchmarkDocker(plan(), { shell: false }, { execute });
  await adapter.remove(); expect(execute.mock.calls[2][1]).toEqual(['rm', '--force', id]);
});
test.each(['other-owner', ''])('never removes an unowned container (%s)', async owner => {
  const execute = jest.fn().mockResolvedValueOnce({ stdout: 'b'.repeat(64) }).mockResolvedValueOnce({ stdout: owner });
  await expect(createInventoryBenchmarkDocker(plan(), {}, { execute }).remove()).rejects.toThrow('not_owned');
  expect(execute.mock.calls.some(call => call[1][0] === 'rm')).toBe(false);
});
test('missing owned container needs no removal; daemon errors do not masquerade as absence', async () => {
  const execute = jest.fn().mockResolvedValue({ stdout: '' });
  await createInventoryBenchmarkDocker(plan(), {}, { execute }).remove();
  expect(execute.mock.calls.every(call => call[1][0] === 'ps')).toBe(true);
  execute.mockRejectedValue(new Error('offline'));
  await expect(createInventoryBenchmarkDocker(plan(), {}, { execute }).remove()).rejects.toThrow('offline');
});
test('transport starts without shell interpolation and with a fresh sidecar-only initialization key', async () => {
  const execute = jest.fn().mockResolvedValue({ stdout: '' }), quiet = { shell: false, windowsHide: true, cwd: 'workspace' };
  const adapter = createInventoryBenchmarkDocker(plan(), quiet, { execute });
  await adapter.start(); await adapter.start();
  const first = execute.mock.calls[0], second = execute.mock.calls[1];
  expect(first.slice(0, 2)).toEqual(['docker', plan().args]); expect(first[2]).toMatchObject(quiet);
  expect(first[2].env.CLASSIFARR_BENCHMARK_IMAGE).toBe(container.image);
  expect(first[2].env.CLASSIFARR_BENCHMARK_EPHEMERAL_KEY).toMatch(/^[a-f0-9]{64}$/);
  expect(first[2].env.CLASSIFARR_BENCHMARK_EPHEMERAL_KEY).not.toBe(second[2].env.CLASSIFARR_BENCHMARK_EPHEMERAL_KEY);
});
test.each(['', 'NaN', '-1', '0\n1'])('rejects malformed Docker wait output %j', async stdout => {
  const execute = jest.fn().mockResolvedValue({ stdout });
  await expect(createInventoryBenchmarkDocker(plan(), {}, { execute }).wait()).rejects.toThrow('exit_invalid');
});
test('Docker wait receives cancellation and a finite deadline; stop checks ownership', async () => {
  const execute = jest.fn().mockResolvedValueOnce({ stdout: '137' }).mockResolvedValueOnce({ stdout: 'b'.repeat(64) })
    .mockResolvedValueOnce({ stdout: runId }).mockResolvedValueOnce({ stdout: '' });
  const adapter = createInventoryBenchmarkDocker(plan(), {}, { execute }), controller = new AbortController();
  expect(await adapter.wait(controller.signal)).toBe(137);
  expect(execute.mock.calls[0][2]).toEqual({ signal: controller.signal, timeout: plan().timeoutMs + 30_000 });
  await adapter.stop(); expect(execute.mock.calls.at(-1)[1]).toEqual(['stop', '--time', '10', 'b'.repeat(64)]);
});
test.each(['not-an-id', `${'b'.repeat(64)}\n${'c'.repeat(64)}`])('ambiguous name lookup %s cannot be removed', async stdout => {
  const execute = jest.fn().mockResolvedValue({ stdout });
  await expect(createInventoryBenchmarkDocker(plan(), {}, { execute }).remove()).rejects.toThrow('ambiguous');
  expect(execute).toHaveBeenCalledTimes(1);
});
test('container still present after removal is an explicit failure', async () => {
  const execute = jest.fn(); for (const stdout of ['b'.repeat(64), runId, '', 'b'.repeat(64), runId]) execute.mockResolvedValueOnce({ stdout });
  await expect(createInventoryBenchmarkDocker(plan(), {}, { execute }).remove()).rejects.toThrow('remaining');
});
test.each([0, 1, 'spawn-error'])('log following drains completion and reports failures (%s)', async result => {
  const child = new EventEmitter(); child.kill = jest.fn();
  const spawn = jest.fn(() => child), follower = createInventoryBenchmarkDocker(plan(), { cwd: 'workspace' }, { spawn }).follow();
  if (result === 'spawn-error') child.emit('error', new Error('failed')); else child.emit('exit', result);
  if (result === 0) await follower.close(); else await expect(follower.close()).rejects.toThrow('logs_failed');
  expect(spawn.mock.calls[0][2]).toMatchObject({ shell: false, windowsHide: true, stdio: 'inherit' });
});
test('log cleanup failure still removes container and cannot become a successful run', async () => {
  const runtime = docker(); runtime.follow.mockReturnValue({ close: async () => { throw new Error('logs_failed'); } });
  await expect(runOwnedInventoryBenchmark(plan(), runtime)).rejects.toThrow('logs_failed'); expect(runtime.remove).toHaveBeenCalledTimes(1);
});
test('Compose job has bounded resources, no app data volume, and read-only database sessions', () => {
  const compose = readFileSync(new URL('../../../../docker-compose.benchmark.yml', import.meta.url), 'utf8');
  for (const expected of ['mem_limit: 2g', 'memswap_limit: 2g', 'cpus: 2', 'pids_limit: 128', 'read_only: true',
    'user: "1000:1000"', 'cap_drop: [ALL]', 'no-new-privileges:true', 'default_transaction_read_only=on']) expect(compose).toContain(expected);
  expect(compose).not.toMatch(/^\s+(volumes|ports):/m);
  expect(compose).not.toContain('docker.sock');
});
