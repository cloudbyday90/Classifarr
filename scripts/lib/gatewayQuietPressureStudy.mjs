/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { captureGatewayHostSnapshot } from './gatewayHostSnapshot.mjs';
import { runGatewayArchiveQualification } from './gatewayArchiveQualification.mjs';
import { runGatewayPressureStudy } from './gatewayPressureStudy.mjs';

export async function runGatewayQuietPressureStudy(image, revision, {
  snapshot = captureGatewayHostSnapshot, run = runGatewayArchiveQualification,
  report = value => process.stdout.write(`${JSON.stringify(value)}\n`),
} = {}) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/); assert.match(revision, /^[a-f0-9]{40}$/);
  let baseline, observations = 0;
  const observe = completedArms => {
    let current;
    try {
      const value = snapshot();
      assert.ok(Number.isSafeInteger(value?.containers) && value.containers >= 0 && value.containers <= 128);
      assert.match(value.sha256, /^[a-f0-9]{64}$/);
      current = { containers: value.containers, sha256: value.sha256 };
    } catch {
      report({ study: 'archiver-quiet', stage: 'timing_inconclusive', reason: 'host_snapshot_unavailable', completedArms, observations });
      throw new Error('gateway_host_snapshot_unavailable');
    }
    observations++;
    const unchanged = !baseline || (current.sha256 === baseline.sha256 && current.containers === baseline.containers);
    report({ study: 'archiver-quiet', stage: 'host_observation', observation: 'endpoint_only', completedArms, observations, ...current, unchanged });
    if (!unchanged) {
      report({ study: 'archiver-quiet', stage: 'timing_inconclusive', reason: 'host_state_changed', completedArms, observations });
      throw new Error('gateway_host_state_changed');
    }
    baseline ??= current;
  };
  observe(0);
  await runGatewayPressureStudy(image, revision, run, report, observe);
  report({ study: 'archiver-quiet', stage: 'passed_cleanup_verified', completedArms: 4, observations,
    timing: 'matching_endpoints_not_proof_of_idleness' });
}
