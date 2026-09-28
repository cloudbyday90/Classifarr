/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { parseResourceCounter, parseResourceFields, readStudyCgroup, summarizeStudySamples,
  createStudySampler, observeStudyAdmission, assertStudyCgroup } from '../../scripts/resourceStudyMetrics.mjs';
import { studyPhase, createResourceStudyFixture, resourceStudyEvaluationSnapshot } from '../../scripts/resourceStudyFixtures.mjs';
import { runResourceStudy } from '../../scripts/runResourceStudy.mjs';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';
import { resourceStudyProfile } from '../../scripts/resourceStudyProfiles.mjs';

const passedReceipt = mode => {
  const profile = resourceStudyProfile(mode);
  return { status: 'passed', version: 'resource_study.v2', profile: mode, requestedDurationMs: profile.durationMs,
    durationMs: profile.durationMs + 100, evaluationRows: profile.rows, vectorDimensions: profile.dimensions,
    queueRecovery: { cohortSize: 20, started: 20, completed: 20, startedDuringPressure: 0,
      holdChecks: 5, heldMs: 10000, firstDispatchMs: 500, completedMs: 2000 } };
};

test.each([null, undefined, '', '-1', '1.5', 'NaN', 'max', '9007199254740992', '2 extra'])('missing/invalid counter %s is unknown, not zero', value => {
  expect(parseResourceCounter(value)).toBeNull();
});
test('counter parser keeps zero and named fields independent of position', () => {
  expect(parseResourceCounter('0\n')).toBe(0);
  expect(parseResourceFields('oom_kill 2\noom 0\nunknown 5\nbad -1\nbad 4\nextra 1 2')).toEqual({ oom_kill: 2, oom: 0, unknown: 5, bad: null });
  expect(parseResourceFields(null)).toEqual({});
});
test('fixed cgroup reader does not hide absent counters or substitute host memory', async () => {
  const read = jest.fn(async path => ({ 'cgroup.controllers': 'cpu memory', 'memory.current': '1024', 'memory.max': '2048',
    'memory.events': 'oom 0\noom_kill 0\nmax 0', 'cpu.stat': 'usage_usec 50\nthrottled_usec 3', 'pids.current': '10' })[path.split('/').at(-1)]);
  expect(await readStudyCgroup(read)).toMatchObject({ version: 2, memoryBytes: 1024, limitBytes: 2048, oom: 0, oomKill: 0, cpuUsec: 50, throttledUsec: 3, pids: 10 });
  expect(read.mock.calls.every(([path]) => path.startsWith('/sys/fs/cgroup/'))).toBe(true);
  expect(await readStudyCgroup(async () => { throw new Error('unavailable'); })).toMatchObject({ memoryBytes: null, cpuUsec: null });
});
test('nearest-rank summaries ignore unknown values, with explicit sample counts', () => {
  expect(summarizeStudySamples([{ rssBytes: 1 }, { rssBytes: 5 }, { rssBytes: null }])).toMatchObject({
    rssBytes: { samples: 2, min: 1, p50: 1, p95: 5, max: 5 }, heapBytes: null });
  expect(summarizeStudySamples([]).rssBytes).toBeNull();
});
test('cgroup v1 normalizes nanoseconds and keeps limit hits distinct from OOM kills', async () => {
  const metrics = await readStudyCgroup(async path => ({ 'memory.usage_in_bytes': '1024',
    'memory.limit_in_bytes': '2048', 'memory.oom_control': 'under_oom 0\noom_kill 0',
    'cpuacct.usage': '50000', 'cpu.stat': 'throttled_time 3000', 'pids.current': '10', 'memory.failcnt': '2' })[path.split('/').at(-1)]);
  expect(metrics).toMatchObject({ version: 1, cpuUsec: 50, throttledUsec: 3, oom: null, oomKill: 0, memoryLimitHits: 2 });
  expect(() => assertStudyCgroup(metrics)).not.toThrow();
  expect(() => assertStudyCgroup({ ...metrics, underOom: 1 })).toThrow('metrics_unavailable');
  expect(() => assertStudyCgroup({ ...metrics, cpuUsec: null })).toThrow('metrics_unavailable');
  expect(() => assertStudyCgroup({ ...metrics, version: 2 })).toThrow('metrics_unavailable');
  expect(() => assertStudyCgroup({ ...metrics, version: 2, oom: 0 })).not.toThrow();
});
const validMetrics = { version: 2, cpuUsec: 100, memoryBytes: 1000, limitBytes: 2000, memoryLimitHits: 0,
  oom: 0, oomKill: 0, pids: 10, throttledUsec: 0 };
test('sampler has explicit lifetime, bounded samples and measured CPU', async () => {
  const sampler = await createStudySampler({ cgroup: async () => validMetrics });
  try {
    await sampler.sample('steady', { pending: 2 });
    expect(sampler.samples[0]).toMatchObject({ phase: 'steady', pending: 2, containerCores: 0 });
    expect(sampler.samples[0].rssBytes).toBeGreaterThan(0);
    sampler.samples.length = 2000;
    await expect(sampler.sample('steady', {})).rejects.toThrow('sample_budget');
  } finally { sampler.close(); }
});
test.each([{ memoryLimitHits: 1 }, { oomKill: 1 }, { limitBytes: 4000 }, { cpuUsec: null }])('sampler rejects telemetry drift %j', async changes => {
  let metrics = validMetrics;
  const sampler = await createStudySampler({ cgroup: async () => metrics });
  try { metrics = { ...validMetrics, ...changes }; await expect(sampler.sample('steady', {})).rejects.toThrow(/resource_study_/); }
  finally { sampler.close(); }
});
test('missing initial telemetry cannot begin a study', async () => {
  await expect(createStudySampler({ cgroup: async () => ({}) })).rejects.toThrow('metrics_unavailable');
});
test('admission tracks bounded class waits, actual lifetime and idempotent release', () => {
  let clock = 0, allowed = false;
  const release = jest.fn(), admission = observeStudyAdmission({ tryAcquire: () => allowed
    ? { allowed, release } : { allowed, reason: 'memory_pressure' } }, () => clock);
  admission.tryAcquire('queue'); clock = 25; admission.tryAcquire('queue');
  clock = 80; allowed = true; const permit = admission.tryAcquire('queue');
  expect(admission.classes.queue).toMatchObject({ memory_pressure: 2, waitMs: 80, maxWaitMs: 80, active: 1, peakActive: 1, waitingSince: null });
  permit.release(); permit.release(); expect(release).toHaveBeenCalledTimes(1);
  expect(admission.classes.queue.active).toBe(0);
});
test.each([[0, 'warmup'], [20, 'steady'], [40, 'provider_outage'], [50, 'telemetry_pressure'], [60, 'recovery'], [100, 'recovery']])('phase %s is %s', (elapsed, phase) => {
  expect(studyPhase(elapsed, 100)).toBe(phase);
});
test('bounded movie/TV fixture models outage without changing its retained source', async () => {
  const fixture = createResourceStudyFixture();
  for (let wave = 0; wave < 50; wave++) fixture.grow();
  expect(fixture.count).toBe(400);
  const page = () => fixture.adapter.getLibraryPage('', '', 'study-2-tv', { offset: 399, limit: 100 });
  expect(await page()).toMatchObject({ total: 401, items: [{ media_type: 'tv' }, { media_type: 'track' }] });
  fixture.setPhase('provider_outage'); await expect(page()).rejects.toThrow('synthetic_provider_outage');
  fixture.setPhase('recovery'); expect((await page()).total).toBe(401);
  expect(await fixture.provider.getMovieDetails(2)).toMatchObject({ id: 2 });
});
test('evaluation fixture runs actual bounded worker with no provider calls or routing writes', async () => {
  const snapshot = resourceStudyEvaluationSnapshot();
  expect(snapshot.inputs.source.rows).toHaveLength(400);
  const result = await runAutomaticSourcePairThread(snapshot, null);
  expect(result.report).toMatchObject({ status: 'complete', limits: { providerCalls: 0, routingWrites: 0 } });
});
test('entry refuses ordinary environments before any database work', async () => {
  await expect(runResourceStudy('soak')).rejects.toThrow();
});

function fakeDocker(override = () => null) {
  return jest.fn((_cmd, args, options) => {
    const replacement = override(args, options); if (replacement) return replacement;
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = `sha256:${'a'.repeat(64)}`;
    if (args[0] === 'inspect') stdout = 'false healthy';
    if (args[7] === 'ps') stdout = 'b'.repeat(64);
    if (args.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"status":"passed"}';
    if (args.includes('src/scripts/runResourceStudy.mjs')) {
      const mode = args.at(-1);
      stdout = `RESOURCE_STUDY ${JSON.stringify(mode === 'seed' ? { seeded: true }
        : passedReceipt(mode))}`;
    }
    return { status: 0, stdout, stderr: '' };
  });
}
const launch = (run, extra = {}) => runResourceStudyCompose({ run, random: size => Buffer.alloc(size, 1), report: () => {}, save: () => {}, ...extra });
test.each(['smoke', 'soak', 'capacity'])('owned study lifecycle labels %s and verifies cleanup', async mode => {
  const run = fakeDocker(), save = jest.fn(), result = await launch(run, { mode, save });
  expect(result).toMatchObject({ mode, cleanup: 'passed' });
  expect(save).toHaveBeenCalledTimes(1);
  const starts = run.mock.calls.filter(([, args]) => args[7] === 'up');
  expect(starts.map(([, , options]) => options.env.CLASSIFARR_UPGRADE_MODE)).toEqual(['normal', 'restore']);
  for (const [, args, options] of run.mock.calls) {
    expect(options).toMatchObject({ shell: false, windowsHide: true, env: { COMPOSE_DISABLE_ENV_FILE: '1' } });
    expect(args).not.toContain('prune');
    if (args[0] === 'compose') expect(args[2]).toMatch(/^classifarr-resource-study-[a-f0-9]{32}$/);
  }
  expect(run.mock.calls.some(([, args]) => args.includes('down') && args.includes('--volumes'))).toBe(true);
});
test.each(['ps', 'volume', 'network', 'image'])('colliding %s is never deleted', operation => {
  const run = fakeDocker(args => args[0] === operation ? { status: 0, stdout: 'existing' } : null);
  return expect(launch(run).finally(() => {
    expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(false);
  })).rejects.toThrow('project_not_empty');
});
test.each(['build', 'up', 'exec', 'invalid_receipt', 'unhealthy'])('failure %s still disposes only owned resources', async failure => {
  const run = fakeDocker(args => {
    if (args[7] === failure) return { status: 1, stdout: '', stderr: 'private input' };
    if (failure === 'invalid_receipt' && args.at(-1) === 'soak') return { status: 0, stdout: 'RESOURCE_STUDY {}' };
    if (failure === 'unhealthy' && args[0] === 'inspect') return { status: 0, stdout: 'true unhealthy' };
    return null;
  });
  const save = jest.fn(); await expect(launch(run, { save })).rejects.toThrow(/resource_study_/);
  expect(save).not.toHaveBeenCalled();
  expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(true);
});
test('cleanup failure prevents saving success and never touches an unrelated image', async () => {
  const save = jest.fn(), run = fakeDocker(args => args.includes('down') ? { status: 1, stdout: '' } : null);
  await expect(launch(run, { save })).rejects.toThrow('command_failed');
  expect(save).not.toHaveBeenCalled();
  expect(run.mock.calls.some(([, args]) => args.includes('classifarr:latest'))).toBe(false);
});
test.each([null, '1800001', 1, 2100001])('receipt rejects invalid elapsed duration %s', async durationMs => {
  const run = fakeDocker(args => args.at(-1) === 'soak' ? { status: 0,
    stdout: `RESOURCE_STUDY ${JSON.stringify({ ...passedReceipt('soak'), durationMs })}` } : null);
  await expect(launch(run)).rejects.toThrow('receipt_invalid');
  expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(true);
});
test.each([{ mode: true }, { mode: 'unknown' }, { mode: {} }, { random: () => Buffer.from('invalid') }])('invalid launcher input fails before docker', async options => {
  const run = fakeDocker(); await expect(launch(run, options)).rejects.toThrow(); expect(run).not.toHaveBeenCalled();
});
test('reused compose topology has no external network, ports, host volumes or privilege', () => {
  const compose = load(readFileSync(new URL('../../../../docker-compose.published-upgrade-drill.yml', import.meta.url), 'utf8'));
  expect(compose.networks.default.internal).toBe(true);
  expect(compose.services.app).toMatchObject({ mem_limit: '2g', restart: 'no', read_only: true, cap_drop: ['ALL'] });
  expect(compose.services.app.ports).toBeUndefined(); expect(compose.services.app.privileged).toBeUndefined();
  expect(compose.services.app.volumes).toEqual(['app-data:/app/data']);
});
