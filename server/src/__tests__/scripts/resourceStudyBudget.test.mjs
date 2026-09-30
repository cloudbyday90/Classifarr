/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { resourceStudyBudget, assertStudyBudget, assertDockerStudyBudget, summarizeBudgetEnforcement, assertStudyBudgetContinuity } from '../../scripts/resourceStudyBudget.mjs';
import { parseResourceLimit, readStudyCgroup, assertStudyCgroup } from '../../scripts/resourceStudyMetrics.mjs';
import { resourceStudyReceiptFixture, resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { assertResourceStudyStartupReceipt, assertResourceStudyReceipt } from '../../scripts/resourceStudyProfiles.mjs';
import { runResourceBudgetComparison } from '../../../../scripts/lib/resourceBudgetComparison.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';
import { studyBudgetDiagnostic, formatStudyBudgetDiagnostic, parseStudyBudgetDiagnostic } from '../../scripts/resourceStudyBudgetDiagnostic.mjs';

test('budget failures expose only allowlisted numerical diagnostics, never private input', () => {
  const metrics = { ...resourceStudyReceiptFixture().initial, pidsLimit: 9457, cpuQuotaUsec: 200000, private: 'SECRET' };
  let caught;
  try { assertStudyBudget(metrics, 'baseline'); } catch (error) { caught = error; }
  expect(caught.message).toBe('resource_study_budget_not_enforced');
  const line = formatStudyBudgetDiagnostic({ ...caught.studyBudget, private: 'SECRET' });
  expect(line).toContain('"pidsLimit":9457'); expect(line).not.toContain('SECRET');
  expect(parseStudyBudgetDiagnostic(line)).toBe(line);
  expect(studyBudgetDiagnostic({ ...metrics, pidsLimit: 'SECRET' }, 'baseline').pidsLimit).toBeNull();
  expect(parseStudyBudgetDiagnostic('RESOURCE_STUDY_BUDGET {"budget":"SECRET"}')).toBeNull();
  expect(parseStudyBudgetDiagnostic('RESOURCE_STUDY_BUDGET invalid')).toBeNull();
  expect(parseStudyBudgetDiagnostic(`RESOURCE_STUDY_BUDGET ${'x'.repeat(1025)}`)).toBeNull();
  expect(formatStudyBudgetDiagnostic(undefined)).toBeNull();
});

test.each([1, 2].flatMap(version => [-1, 128, 19151].map(pidsLimit => [version, pidsLimit])))('cgroup v%s baseline records a valid host-default PID ceiling %s', (version, pidsLimit) => {
  const metrics = { ...resourceStudyReceiptFixture().initial, version, oom: version === 1 ? null : 0, underOom: 0, pidsLimit };
  expect(() => assertStudyCgroup(metrics)).not.toThrow();
  expect(() => assertStudyBudget(metrics, 'baseline')).not.toThrow();
});

test.each([null, undefined, 0, -2, 127, 19151.5, '19151', Infinity])('invalid or more restrictive baseline PID limit %s fails', pidsLimit => {
  expect(() => assertStudyBudget({ ...resourceStudyReceiptFixture().initial, pidsLimit }, 'baseline')).toThrow('not_enforced');
});

test.each(['version', 'limitBytes', 'cpuQuotaUsec', 'cpuPeriodUsec', 'pidsLimit'])('effective %s drift across startup/restart fails', key => {
  const metrics = { ...resourceStudyReceiptFixture().initial, pidsLimit: 19151 };
  expect(() => assertStudyBudgetContinuity(metrics, { ...metrics })).not.toThrow();
  expect(() => assertStudyBudgetContinuity(metrics, { ...metrics, [key]: metrics[key] + 1 })).toThrow('budget_drift');
  expect(() => assertStudyBudgetContinuity(metrics, { ...metrics, [key]: null })).toThrow('budget_drift');
});

test('continuity requires at least two complete snapshots', () => {
  expect(() => assertStudyBudgetContinuity()).toThrow('budget_drift');
  expect(() => assertStudyBudgetContinuity({})).toThrow('budget_drift');
  expect(() => assertStudyBudgetContinuity(undefined, undefined)).toThrow('budget_drift');
});

test.each([undefined, null, 1, {}, '__proto__', 'bounded;echo unsafe'])('rejects non-allowlisted budget %s', value => {
  expect(() => resourceStudyBudget(value)).toThrow('budget_invalid');
});
test('budgets are immutable and never change memory', () => {
  expect(Object.isFrozen(resourceStudyBudget('bounded'))).toBe(true);
  expect(resourceStudyBudget('bounded')).toEqual({ cpus: 2, pids: 128 });
  expect(resourceStudyBudget('stress')).toEqual({ cpus: 1, pids: 128 });
});
test.each([[null, null], ['max', -1], ['-1\n', -1], ['0', null], ['1.5', null], ['128', 128],
  ['1 extra', null], ['-2', null]])('limit %s distinguishes unknown and unlimited', (value, expected) => {
  expect(parseResourceLimit(value)).toBe(expected);
});

const v2 = { 'cgroup.controllers': 'cpu memory pids', 'memory.current': '1024', 'memory.max': '2147483648',
  'memory.events': 'max 0\noom 0\noom_kill 0', 'cpu.max': '200000 100000',
  'cpu.stat': 'usage_usec 50000\nnr_periods 40\nnr_throttled 5\nthrottled_usec 3000',
  'pids.current': '40', 'pids.max': '128', 'pids.events': 'max 0' };
const reader = values => async path => values[path.split('/').at(-1)];
test('cgroup v2 independently verifies configured limits and enforcement counters', async () => {
  const metrics = await readStudyCgroup(reader(v2));
  expect(metrics).toMatchObject({ cpuQuotaUsec: 200000, cpuPeriodUsec: 100000, cpuPeriods: 40,
    cpuThrottledPeriods: 5, throttledUsec: 3000, pidsLimit: 128, pidsLimitHits: 0 });
  expect(() => assertStudyCgroup(metrics)).not.toThrow();
  expect(() => assertStudyBudget(metrics, 'bounded')).not.toThrow();
  expect(() => assertStudyBudget(metrics, 'baseline')).toThrow('not_enforced');
});
test.each([{ 'cpu.max': '200000 100000 extra' }, { 'pids.events': undefined },
  { 'pids.events': 'max 1' }, { 'cpu.stat': 'usage_usec 50000' }, { 'pids.max': '0' }])('missing/denied budget telemetry fails closed: %j', async changes => {
  const metrics = await readStudyCgroup(reader({ ...v2, ...changes }));
  expect(() => assertStudyCgroup(metrics)).toThrow('metrics_unavailable');
});
test.each([{ cpuQuotaUsec: -1 }, { cpuPeriodUsec: 0 }, { cpuPeriodUsec: 200000 },
  { pidsLimit: -1 }, { pidsLimit: 19151 }, { limitBytes: 1e9 }, { pidsLimitHits: 1 }])('ineffective cgroup limits fail: %j', changes => {
  expect(() => assertStudyBudget({ ...resourceStudyReceiptFixture('capacity', 'bounded').initial, ...changes }, 'bounded')).toThrow('not_enforced');
});
test.each(['baseline', 'bounded', 'stress'])('Docker config verification for %s is independent of cgroup data', budget => {
  const limits = resourceStudyBudget(budget);
  const config = { nanoCpus: limits.cpus * 1e9, pids: limits.pids, cpuQuota: 0, memoryBytes: 2 * 1024 ** 3 };
  expect(() => assertDockerStudyBudget(config, budget)).not.toThrow();
  expect(() => assertDockerStudyBudget({ ...config, nanoCpus: 3e9 }, budget)).toThrow('mismatch');
  expect(() => assertDockerStudyBudget({ ...config, pids: 12 }, budget)).toThrow('mismatch');
  expect(() => assertDockerStudyBudget({ ...config, cpuQuota: 200000 }, budget)).toThrow('mismatch');
});
test('throttling is reported as counter deltas, never percent wall time or a fabricated zero', () => {
  const initial = resourceStudyReceiptFixture().initial;
  expect(summarizeBudgetEnforcement(initial, initial).throttledPeriodPercent).toBeNull();
  expect(summarizeBudgetEnforcement(initial, { ...initial, cpuUsec: 150, cpuPeriods: 20,
    cpuThrottledPeriods: 5, throttledUsec: 200 })).toMatchObject({ cpuUsec: 50, cpuPeriods: 20, throttledPeriodPercent: 25 });
  expect(() => summarizeBudgetEnforcement(initial, { ...initial, cpuUsec: 99 })).toThrow('counter_regression');
  expect(() => summarizeBudgetEnforcement(initial, { ...initial, cpuPeriods: null })).toThrow('counter_regression');
});

const scenario = budget => ({ budget, mode: 'capacity', imageId: `sha256:${'a'.repeat(64)}`, cleanup: 'passed',
  startup: { fresh: resourceStudyStartupFixture(budget), maintenance: resourceStudyStartupFixture(budget) },
  study: resourceStudyReceiptFixture('capacity', budget) });
const compare = options => runResourceBudgetComparison({ random: size => Buffer.alloc(size, 3),
  withImage: work => work(`sha256:${'a'.repeat(64)}`), report: () => {}, save: () => {}, ...options });
test('comparison is sequential, matched, fixed-order and aggregate-only', async () => {
  let active = 0;
  const study = jest.fn(async ({ budget, mode, candidateImageId }) => {
    expect(candidateImageId).toBe(`sha256:${'a'.repeat(64)}`);
    expect(mode).toBe('capacity'); expect(++active).toBe(1);
    await Promise.resolve(); active--;
    return { ...scenario(budget), private: 'SECRET' };
  });
  const save = jest.fn(), result = await compare({ study, save });
  expect(study.mock.calls.map(([args]) => args.budget)).toEqual(['baseline', 'bounded', 'stress']);
  expect(result.scenarios).toHaveLength(3);
  expect(result.status).toBe('passed'); expect(save).toHaveBeenCalledTimes(1);
  expect(result.scenarios.map(row => row.effectiveLimits.pids)).toEqual([-1, 128, 128]);
  expect(JSON.stringify(result)).not.toContain('SECRET');
});

test('comparison rejects baseline drift across individually valid startup receipts', async () => {
  const save = jest.fn();
  await expect(compare({ save, study: async ({ budget }) => {
    const result = scenario(budget);
    result.startup.fresh.metrics.pidsLimit = 19151;
    return result;
  } })).rejects.toThrow('budget_drift');
  expect(save).not.toHaveBeenCalled();
});

test('v5 comparison labels repeated task completions but still requires the original minimum workload', async () => {
  const result = await compare({ study: async ({ budget }) => {
    const run = scenario(budget); run.study.backlog.completed = 2500; return run;
  } });
  expect(result.version).toBe('resource_budget_comparison.v2');
  expect(result.scenarios.every(row => row.completed === 2500 && row.retryRolledBackClaims > 0)).toBe(true);
  await expect(compare({ study: async ({ budget }) => {
    const run = scenario(budget); run.study.backlog.completed = 1619; return run;
  } })).rejects.toThrow('comparison_incomplete');
});
test.each(['failure', 'image_drift', 'cleanup_failed', 'wrong_budget', 'missing_metrics', 'incomplete_work', 'no_evaluation', 'missing_startup'])('comparison cannot publish success after %s', async failure => {
  const save = jest.fn(), study = jest.fn(async ({ budget }) => {
    const result = scenario(budget);
    if (budget !== 'bounded') return result;
    if (failure === 'failure') throw new Error('failed');
    if (failure === 'image_drift') result.imageId = `sha256:${'b'.repeat(64)}`;
    if (failure === 'cleanup_failed') result.cleanup = 'failed';
    if (failure === 'wrong_budget') result.study.budget = 'baseline';
    if (failure === 'missing_metrics') delete result.study.metrics;
    if (failure === 'incomplete_work') result.study.backlog.pending = 1;
    if (failure === 'no_evaluation') result.study.counters.evaluations = 0;
    if (failure === 'missing_startup') delete result.startup;
    return result;
  });
  await expect(compare({ study, save })).rejects.toThrow();
  expect(save).not.toHaveBeenCalled(); expect(study).toHaveBeenCalledTimes(2);
});
test('invalid identity fails before study creation', async () => {
  const study = jest.fn(); await expect(compare({ study, random: () => Buffer.from('bad') })).rejects.toThrow('identity_invalid');
  expect(study).not.toHaveBeenCalled();
});

test('budget override contains only CPU and PID configuration', () => {
  const override = load(readFileSync(new URL('../../../../docker-compose.resource-study-budget.yml', import.meta.url), 'utf8'));
  expect(Object.keys(override)).toEqual(['services']);
  expect(Object.keys(override.services)).toEqual(['app']);
  expect(Object.keys(override.services.app).sort()).toEqual(['cpus', 'pids_limit']);
});

function dockerFixture({ mismatch = false, startupDenial = false, imageMismatch = false } = {}) {
  return jest.fn((_cmd, args, { env }) => {
    let stdout = '';
    const budget = env.CLASSIFARR_RESOURCE_STUDY_CPUS === '2' ? 'bounded' : 'stress';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = `sha256:${'a'.repeat(64)}`;
    if (args[0] === 'compose' && args.includes('ps')) stdout = 'b'.repeat(64);
    if (args[0] === 'inspect') stdout = args[2].includes('HostConfig') ? JSON.stringify({
      nanoCpus: mismatch ? 0 : Number(env.CLASSIFARR_RESOURCE_STUDY_CPUS) * 1e9,
      pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0,
      imageId: `sha256:${(imageMismatch ? 'b' : 'a').repeat(64)}` }) : 'false healthy';
    if (args.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"status":"passed"}';
    if (args.includes('src/scripts/runResourceStudy.mjs')) {
      const mode = args.at(-1), startup = resourceStudyStartupFixture(budget);
      if (startupDenial) startup.metrics.pidsLimitHits = 1;
      stdout = `RESOURCE_STUDY ${JSON.stringify(mode === 'seed' ? { seeded: true }
        : mode.startsWith('budget-') ? startup : resourceStudyReceiptFixture('capacity', budget))}`;
    }
    return { status: 0, stdout, stderr: '' };
  });
}
test.each(['bounded', 'stress'])('launcher verifies %s after both starts, with fixed override and environment', async budget => {
  const run = dockerFixture(), save = jest.fn();
  await runResourceStudyCompose({ run, budget, mode: 'capacity', save, report: () => {} });
  const checks = run.mock.calls.filter(([, args]) => args[0] === 'inspect' && args[2].includes('HostConfig'));
  expect(checks).toHaveLength(2);
  expect(run.mock.calls.filter(([, args]) => args.includes('src/scripts/runResourceStudy.mjs') &&
    args.at(-1).startsWith('budget-')).map(([, args]) => args.at(-1))).toEqual(['budget-normal', 'budget-restore']);
  const starts = run.mock.calls.filter(([, args]) => args.includes('up'));
  expect(starts.every(([, args, { env }]) => args.some(value => value.endsWith('docker-compose.resource-study-budget.yml')) &&
    env.CLASSIFARR_RESOURCE_STUDY_PIDS === '128' && env.COMPOSE_DISABLE_ENV_FILE === '1')).toBe(true);
  expect(save).toHaveBeenCalledTimes(1);
});

test('startup PID denial prevents seeding and still cleans owned resources', async () => {
  const run = dockerFixture({ startupDenial: true }), save = jest.fn();
  await expect(runResourceStudyCompose({ run, budget: 'bounded', mode: 'capacity', save, report: () => {} })).rejects.toThrow('metrics_unavailable');
  expect(run.mock.calls.some(([, args]) => args.at(-1) === 'seed')).toBe(false);
  expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

test.each([{ memoryLimitHits: 1 }, { oomKill: 1 }, { oom: 1 }])('startup memory pressure cannot be hidden by a healthy container: %j', change => {
  const receipt = resourceStudyStartupFixture(); Object.assign(receipt.metrics, change);
  expect(() => assertResourceStudyStartupReceipt(receipt, 'baseline')).toThrow('startup_pressure');
});

test('receipt rejects period drift even when the CPU quota ratio is unchanged', () => {
  const receipt = resourceStudyReceiptFixture('capacity', 'bounded');
  receipt.final.cpuQuotaUsec *= 2; receipt.final.cpuPeriodUsec *= 2;
  expect(() => assertResourceStudyReceipt(receipt, 'capacity', 'bounded')).toThrow('budget_drift');
});

test('shared immutable image is verified but never rebuilt or removed by a scenario', async () => {
  const run = dockerFixture();
  await runResourceStudyCompose({ run, budget: 'bounded', mode: 'capacity', candidateImageId: `sha256:${'a'.repeat(64)}`,
    save: () => {}, report: () => {} });
  expect(run.mock.calls.some(([, args]) => args.includes('build') || args.includes('rm'))).toBe(false);
  expect(run.mock.calls.filter(([, args]) => args.includes('up')).every(([, , { env }]) =>
    env.CLASSIFARR_UPGRADE_IMAGE === `sha256:${'a'.repeat(64)}`)).toBe(true);
});

test('shared-image cleanup failure cannot publish a passing comparison', async () => {
  const save = jest.fn();
  await expect(compare({ study: async ({ budget }) => scenario(budget), save,
    withImage: async work => { await work(`sha256:${'a'.repeat(64)}`); throw new Error('image_cleanup_failed'); } })).rejects.toThrow('image_cleanup_failed');
  expect(save).not.toHaveBeenCalled();
});

test('container image substitution fails before workload and preserves shared-image ownership', async () => {
  const run = dockerFixture({ imageMismatch: true }), save = jest.fn();
  await expect(runResourceStudyCompose({ run, budget: 'bounded', mode: 'capacity', candidateImageId: `sha256:${'a'.repeat(64)}`,
    save, report: () => {} })).rejects.toThrow('container_image_mismatch');
  expect(run.mock.calls.some(([, args]) => args.includes('exec') || args.includes('rm'))).toBe(false);
  expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
test('unenforced Docker budget stops before probes, cleans owned resources and emits no success', async () => {
  const run = dockerFixture({ mismatch: true }), save = jest.fn();
  await expect(runResourceStudyCompose({ run, budget: 'bounded', mode: 'capacity', save, report: () => {} })).rejects.toThrow('mismatch');
  expect(run.mock.calls.some(([, args]) => args.includes('exec'))).toBe(false);
  expect(run.mock.calls.some(([, args]) => args.includes('down'))).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
