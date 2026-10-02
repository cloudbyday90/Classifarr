/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { frozenResourceSoakEvidence, formatFrozenSoakSummary } from '../../../../scripts/lib/frozenResourceSoakEvidence.mjs';
import { resourceStudyReceiptFixture, resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';

const imageId = `sha256:${'a'.repeat(64)}`;
const fixture = () => ({ mode: 'soak', budget: 'bounded', imageId, cleanup: 'passed',
  startup: { fresh: resourceStudyStartupFixture('bounded'), maintenance: resourceStudyStartupFixture('bounded') },
  study: resourceStudyReceiptFixture('soak', 'bounded') });

test('reconstructs scoped soak evidence with fixed units, idle trends and lifecycle counters', () => {
  const result = frozenResourceSoakEvidence(fixture(), imageId);
  expect(result).toMatchObject({ status: 'passed', imageId, studyVersion: 'resource_study.v6',
    requestedDurationMs: 1800000, inventory: 1600, uniqueCompleted: 1600, cleanup: 'passed',
    trend: { phases: { idle: { spanMs: 120000, backlog: { peakPending: 0, completedDelta: 0 } } } },
    observations: { containerPeakBytes: 1024, containerCoresP95: 1, eventLoopP99MaxMs: 20, pidsPeak: 10 },
    enforcement: { cpuPeriods: 0, throttledPeriodPercent: null } });
  expect(formatFrozenSoakSummary(result)).toContain('1600/1600');
  expect(formatFrozenSoakSummary(result)).toContain('not instantaneous peaks');
});

test('projection never retains unknown nested data or the unused cgroup-v1 field on v2', () => {
  const value = fixture();
  for (const row of [value, value.study, value.study.metrics, value.study.backlog, value.study.providerRecovery,
    value.study.queueRecovery, value.study.trend, value.study.trend.phases.idle,
    value.study.trend.phases.idle.memory.rssBytes, value.study.trend.phases.idle.backlog,
    value.startup.fresh.metrics, value.startup.maintenance.metrics, value.study.initial, value.study.final]) {
    row.private = 'private-value';
  }
  value.study.initial.underOom = 'private-value';
  const receipt = frozenResourceSoakEvidence(value, imageId);
  expect(JSON.stringify(receipt)).not.toContain('private');
  value.study.trend.phases.idle.memory.rssBytes.earlyMedianBytes = 0;
  expect(receipt.trend.phases.idle.memory.rssBytes.earlyMedianBytes).toBe(1000);
});

test.each([
  ['missing', () => undefined],
  ['mutable image', row => { row.imageId = 'classifarr:latest'; }],
  ['other image', row => { row.imageId = `sha256:${'b'.repeat(64)}`; }],
  ['old receipt', row => { row.study.version = 'resource_study.v5'; }],
  ['smoke', row => { row.study = resourceStudyReceiptFixture('smoke', 'bounded'); }],
  ['capacity', row => { row.mode = 'capacity'; }],
  ['missing startup', row => { delete row.startup; }],
  ['missing limits', row => { delete row.study.initial.cpuQuotaUsec; }],
  ['wrong budget', row => { row.budget = 'baseline'; }],
  ['restart drift', row => { row.startup.maintenance.metrics.version = 1; }],
  ['cleanup', row => { row.cleanup = 'not_verified'; }],
  ['short duration', row => { row.study.durationMs = 1919999; }],
  ['unbounded duration', row => { row.study.durationMs = 2220001; }],
  ['short idle', row => { row.study.trend.phases.idle.spanMs = 119999; }],
  ['unsettled idle', row => { row.study.trend.phases.idle.backlog.peakPending = 1; }],
  ['short recovery', row => { row.study.trend.phases.recovery.spanMs = 1000; }],
  ['pending work', row => { row.study.backlog.pending = 1; }],
  ['failed work', row => { row.study.backlog.failed = 1; }],
  ['routing', row => { row.study.backlog.routing = 1; }],
  ['provider work unfinished', row => { row.study.providerRecovery.pending = 1; }],
  ['no evaluation work', row => { row.study.counters.evaluations = 0; }],
  ['no outage preservation', row => { row.study.counters.preservedOutages = 0; }],
  ['missing work counters', row => { delete row.study.counters; }],
  ['duplicate dispatch', row => { row.study.queueRecovery.started = 21; }],
  ['dispatch during pressure', row => { row.study.queueRecovery.startedDuringPressure = 1; }],
  ['lost inventory', row => { row.study.uniqueCompleted = 1599; }],
  ['OOM', row => { row.study.final.oomKill = 1; }],
  ['memory hit', row => { row.study.final.memoryLimitHits = 1; }],
  ['PID denial', row => { row.study.final.pidsLimitHits = 1; }],
  ['regressed CPU', row => { row.study.final.cpuUsec = 99; }],
  ['missing metric', row => { delete row.study.metrics.containerCores; }],
  ['negative metric', row => { row.study.metrics.eventLoopP99Ms.max = -1; }],
  ['nonfinite metric', row => { row.study.metrics.containerCores.p95 = NaN; }],
  ['unsafe numeric value', row => { row.study.metrics.containerCores.p95 = Number.MAX_SAFE_INTEGER + 1; }],
  ['string metric', row => { row.study.metrics.eventLoopP99Ms.max = 'private-value'; }],
  ['memory exceeds budget', row => { row.study.metrics.containerBytes.max = 2 * 1024 ** 3 + 1; }],
  ['PID exceeds budget', row => { row.study.metrics.pids.max = 129; }],
])('rejects %s evidence', (_name, mutate) => {
  const value = fixture();
  if (_name === 'missing') return expect(() => frozenResourceSoakEvidence(undefined, imageId)).toThrow();
  mutate(value);
  expect(() => frozenResourceSoakEvidence(value, imageId)).toThrow();
});

test('cgroup v1 retains its own measured semantics without fabricating v2 OOM counts', () => {
  const value = fixture();
  for (const row of [value.startup.fresh.metrics, value.startup.maintenance.metrics, value.study.initial, value.study.final]) {
    Object.assign(row, { version: 1, oom: null, underOom: 0 });
  }
  expect(frozenResourceSoakEvidence(value, imageId)).toMatchObject({ initial: { version: 1, oom: null, underOom: 0 } });
});

test('unknown and historical absence render as unverified, not a soak pass', () => {
  expect(formatFrozenSoakSummary(undefined)).toBe('Sustained resource soak: not verified.\n\n');
  expect(formatFrozenSoakSummary({ status: 'not_verified' })).toContain('not verified');
  expect(() => frozenResourceSoakEvidence(fixture(), 'latest')).toThrow();
});
