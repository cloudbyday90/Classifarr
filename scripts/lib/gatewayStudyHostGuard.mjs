/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { captureGatewayHostSnapshot } from './gatewayHostSnapshot.mjs';

/** Boundary checks only. Call after completed arm results and verified owned cleanup. */
export function createGatewayStudyHostGuard({ study, report, snapshot = captureGatewayHostSnapshot }) {
  assert.ok(['archiver-quiet','sustained-comparison'].includes(study));
  let baseline, observations = 0;
  return { get observations() { return observations; }, observe(completedArms) {
    let current;
    try {
      const value = snapshot();
      assert.ok(Number.isSafeInteger(value?.containers) && value.containers >= 0 && value.containers <= 128);
      assert.match(value.sha256, /^[a-f0-9]{64}$/);
      current = { containers:value.containers, sha256:value.sha256 };
    } catch {
      report({ study, stage:'timing_inconclusive', reason:'host_snapshot_unavailable', completedArms, observations });
      throw new Error('gateway_host_snapshot_unavailable');
    }
    observations++;
    const unchanged = !baseline || (current.sha256 === baseline.sha256 && current.containers === baseline.containers);
    report({ study, stage:'host_observation', observation:'endpoint_only', completedArms, observations, ...current, unchanged });
    if (!unchanged) {
      report({ study, stage:'timing_inconclusive', reason:'host_state_changed', completedArms, observations });
      throw new Error('gateway_host_state_changed');
    }
    baseline ??= current;
  } };
}
