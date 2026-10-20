/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runGatewayInferenceSoak } from './gatewayInferenceSoak.mjs';
import { createGatewayStudyHostGuard } from './gatewayStudyHostGuard.mjs';
import { requireGatewaySustainedArm } from './gatewaySustainedContract.mjs';

export async function runGatewaySustainedComparison(image, revision, {
  run = runGatewayInferenceSoak, snapshot, report = value => process.stdout.write(`${JSON.stringify(value)}\n`),
} = {}) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/); assert.match(revision, /^[a-f0-9]{40}$/);
  const study = 'sustained-comparison', guard = createGatewayStudyHostGuard({study,snapshot,report});
  guard.observe(0);
  for (const [index, treatment] of ['off','on','on','off'].entries()) {
    const profile = `comparison-${treatment}`;
    report({study,run:index + 1,treatment,stage:'started'});
    const result = requireGatewaySustainedArm(await run(image,revision,profile,'comparison'),profile);
    report({study,run:index + 1,treatment,stage:'arm_correctness_passed_cleanup_verified',...result});
    guard.observe(index + 1);
  }
  report({study,stage:'passed_cleanup_verified',arms:4,observations:guard.observations,
    latency:'diagnostic_not_production_acceptance',timing:'matching_endpoints_not_proof_of_idleness'});
}
