/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';
import { assertStudyFixtureVolume,verifyStudyFixtureProtection } from './gatewayStudyInputs.mjs';

export const QUALIFICATION_DRIVER = 'archiveQualificationDriver.mjs';

/** Empty startup output is pending only while running; never accept unbound rows. */
export function qualificationRecords(output,binding,running = false) {
  if (output === '' && running) return [];
  return requireBoundStudyOutput(output,binding,QUALIFICATION_DRIVER).split('\n')
    .filter(line => line.startsWith('{')).map(line => JSON.parse(line));
}

export function createQualificationExecution({docker,source,binding,stores,inspect,catalog,shape,check = runDockerCheckCommand}) {
  assert.equal(binding.manifest.study,'qualification');
  const value = inspect(source); assert.equal(value.Image,binding.manifest.image);
  assertStudyFixtureVolume(value,stores.fixtures);
  const entry = catalog ? 'catalogQualificationData.mjs' : 'archiveQualificationData.mjs';
  verifyStudyFixtureProtection(docker,source,entry);
  const prefix = ['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
    '-e',`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`,source,'node'];
  const refused = check([...prefix,...studyNodeArgs({...binding,sha256:'0'.repeat(64)},entry)],{timeoutMs:10000});
  assert.equal(refused.ok,false); assert.equal(refused.exitCode,1);
  assert.deepEqual(JSON.parse(refused.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
  process.stdout.write(`${JSON.stringify({scenario:shape,stage:'qualification_binding_refusal_and_input_protection_passed',sha256:binding.sha256})}\n`);
  return action => JSON.parse(requireBoundStudyOutput(docker([...prefix,...studyNodeArgs(binding,entry,[action,shape])]),binding,entry));
}
