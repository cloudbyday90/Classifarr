/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';
import { assertStudyFixtureVolume,verifyStudyFixtureProtection } from './gatewayStudyInputs.mjs';

export const SCHEDULING_ENTRY = 'catalogScheduling.mjs';
const common = ['setup','worker','register-only','quiet','inference','accept-inference'];

export function schedulingActionArgs(binding,action) {
  assert.equal(binding.manifest.study,'scheduling');
  assert.ok(['regression','rotation'].includes(binding.manifest.profile));
  const actions = binding.manifest.profile === 'rotation' ? ['study-begin','study-refresh','study-check'] : ['refresh','handoff','owned-prepare','owned-capture','owned-check'];
  assert.ok([...common,...actions].includes(action),'scheduling_action_invalid');
  return studyNodeArgs(binding,SCHEDULING_ENTRY,[action]);
}

/** Verify all executable inputs before any synthetic database setup. */
export function createSchedulingExecution({docker,source,binding,stores,inspect,check = runDockerCheckCommand}) {
  const value = inspect(source); assert.equal(value.Image,binding.manifest.image);
  assertStudyFixtureVolume(value,stores.fixtures);
  verifyStudyFixtureProtection(docker,source,SCHEDULING_ENTRY);
  const prefix = ['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
    '-e',`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`,source,'node'];
  const refused = check([...prefix,...schedulingActionArgs({...binding,sha256:'0'.repeat(64)},'setup')],{timeoutMs:10000});
  assert.equal(refused.ok,false); assert.equal(refused.exitCode,1);
  assert.deepEqual(JSON.parse(refused.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
  process.stdout.write(`${JSON.stringify({stage:'scheduling_binding_refusal_and_input_protection_passed',sha256:binding.sha256})}\n`);
  return action => requireBoundStudyOutput(docker([...prefix,...schedulingActionArgs(binding,action)]),binding,SCHEDULING_ENTRY);
}

export function assertSchedulingVerification(output,value) {
  assert.equal(typeof output,'string'); assert.ok(Buffer.byteLength(output) <= 1048576);
  assert.deepEqual(JSON.parse(output),{state:'verified',purgeAuthorized:false},'scheduling_verification_invalid');
  assert.equal(value.State.Running,false); assert.equal(value.State.ExitCode,0); assert.equal(value.State.OOMKilled,false);
}
