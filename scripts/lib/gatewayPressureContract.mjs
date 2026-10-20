/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export function requirePressureCapture(logs,measure) {
  assert.equal(typeof measure,'boolean');
  assert.equal(logs.filter(row=>row.fixture==='metrics').length,1,'pressure_metrics_duplicate_or_missing');
  assert.equal(logs.filter(row=>row.fixture==='observations').length,measure ? 1 : 0,'pressure_observations_duplicate_or_missing');
  const metric=logs.find(row=>row.fixture==='metrics'),observation=logs.find(row=>row.fixture==='observations');
  assert.ok(metric && Number.isFinite(metric.workerElapsedMs) && metric.workerElapsedMs>0 && metric.workerElapsedMs<210000,'pressure_metrics_missing');
  assert.ok(metric.accounting?.before && metric.accounting?.after && metric.accounting?.delta,'pressure_accounting_missing');
  if (measure) {
    assert.ok(observation && Number.isInteger(observation.samples) && observation.samples>0 && observation.samples<=420 &&
      observation.samples>=metric.workerElapsedMs/1400 && !observation.capReached && observation.failedSamples===0 &&
      Number.isFinite(observation.maxGapMs) && observation.maxGapMs<=5000,'pressure_observation_coverage');
    for (const field of ['current','cgroup']) assert.ok(Number.isInteger(observation.coverage?.[field]) &&
      observation.coverage[field]>=observation.samples*0.9 && observation.coverage[field]<=observation.samples,'pressure_observation_coverage');
    assert.ok(Number.isFinite(observation.peaks?.cgroup?.value) && observation.peaks.cgroup.value>=0,'pressure_observation_coverage');
  } else assert.equal(observation,undefined,'pressure_unsampled_has_periodic_probe');
  return {...metric,...(observation ? {observation} : {})};
}
