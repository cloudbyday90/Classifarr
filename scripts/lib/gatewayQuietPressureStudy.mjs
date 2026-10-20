/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { captureGatewayHostSnapshot } from './gatewayHostSnapshot.mjs';
import { runGatewayArchiveQualification } from './gatewayArchiveQualification.mjs';
import { runGatewayPressureStudy } from './gatewayPressureStudy.mjs';
import { createGatewayStudyHostGuard } from './gatewayStudyHostGuard.mjs';

export async function runGatewayQuietPressureStudy(image, revision, {
  snapshot = captureGatewayHostSnapshot, run = runGatewayArchiveQualification,
  report = value => process.stdout.write(`${JSON.stringify(value)}\n`),
} = {}) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/); assert.match(revision, /^[a-f0-9]{40}$/);
  const guard = createGatewayStudyHostGuard({ study:'archiver-quiet', snapshot, report });
  guard.observe(0);
  await runGatewayPressureStudy(image, revision, run, report, guard.observe);
  report({ study: 'archiver-quiet', stage: 'passed_cleanup_verified', completedArms: 4, observations:guard.observations,
    timing: 'matching_endpoints_not_proof_of_idleness' });
}
