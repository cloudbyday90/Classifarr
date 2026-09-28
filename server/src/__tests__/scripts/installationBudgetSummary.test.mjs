/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { formatInstallationBudgetSummary } from '../../../../scripts/lib/installationBudgetSummary.mjs';
import { evidence } from '../fixtures/installationBudget.mjs';

const budget = () => ({ status: 'passed', fresh: evidence(), upgrade: evidence() });
const snapshots = scenario => [scenario.pressure.initial, scenario.pressure.pressured, scenario.pressure.recovered, scenario.postRestart];

test.each([1, 2])('reports actual cgroup v%i and independently measured recovery', version => {
  const value = budget();
  for (const scenario of [value.fresh, value.upgrade]) {
    for (const snapshot of snapshots(scenario)) Object.assign(snapshot, { version, oom: version === 2 ? 0 : null, underOom: version === 1 ? 0 : null });
  }
  value.upgrade.restartReadyMs = 15001;
  value.upgrade.backfillRecoveryMs = 40500;
  const text = formatInstallationBudgetSummary(value);
  expect(text).toContain(`| Cgroup during pressure / after restart | v${version} / v${version} | v${version} / v${version} |`);
  expect(text).toContain('| Verified CPU / PID / memory limits | 2 CPUs / 128 / 2 GiB | 2 CPUs / 128 / 2 GiB |');
  expect(text).toContain('| Restart readiness | 12.000 s | 15.001 s |');
  expect(text).toContain('| Backfill completion after readiness | 30.000 s | 40.500 s |');
  expect(text).toContain('32 / SQLSTATE 53300');
  expect(text).toContain('512.00 MiB');
  expect(text).toContain('not peaks or safe minimums');
  expect(text).toContain('do not authorize live limits');
});

test('absent or failed budget evidence never invents measurements', () => {
  expect(formatInstallationBudgetSummary(undefined)).toBe('');
  const text = formatInstallationBudgetSummary({ status: 'not_verified', fresh: evidence(), private: 'secret' });
  expect(text).toContain('Not verified');
  expect(text).not.toMatch(/secret|Passed|CPUs|cgroup|MiB/);
});

test('raw extra fields cannot enter a successful summary', () => {
  const value = budget();
  value.fresh.pressure.initial.raw = 'token=secret';
  value.upgrade.debug = '<script>private</script>';
  expect(formatInstallationBudgetSummary(value)).not.toMatch(/secret|private|script/);
});

test.each([
  ['missing fresh', value => { delete value.fresh; }],
  ['missing upgrade', value => { delete value.upgrade; }],
  ['missing counter', value => { value.upgrade.postRestart.pidsLimitHits = null; }],
  ['memory limit hit', value => { value.fresh.pressure.pressured.memoryLimitHits = 1; }],
  ['PID denial', value => { value.upgrade.postRestart.pidsLimitHits = 1; }],
  ['OOM kill', value => { value.fresh.postRestart.oomKill = 1; }],
  ['unlimited CPU', value => { value.fresh.postRestart.cpuQuotaUsec = -1; }],
  ['missing cgroup version', value => { delete value.fresh.postRestart.version; }],
  ['unsafe measurement', value => { value.fresh.restartReadyMs = '<script>'; }],
  ['unknown status', value => { value.status = 'almost_passed'; }],
])('rejects a claimed pass with %s', (_label, mutate) => {
  const value = budget();
  mutate(value);
  expect(() => formatInstallationBudgetSummary(value)).toThrow();
});
