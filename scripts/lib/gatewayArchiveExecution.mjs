/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';
import { assertStudyFixtureVolume,verifyStudyFixtureProtection } from './gatewayStudyInputs.mjs';

/** Default-family stdout can be text, UUIDv7 or a receipt, not just JSON records. */
export function createArchiveExecution({docker,source,binding,stores,inspect}) {
  assert.equal(binding.manifest.study,'archive'); assert.equal(binding.manifest.profile,'regression');
  const value = inspect(source); assert.equal(value.Image,binding.manifest.image);
  assertStudyFixtureVolume(value,stores.fixtures);
  verifyStudyFixtureProtection(docker,source,'archiveRestoreInput.mjs');
  const prefix = ['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
    '-e','CLASSIFARR_SOAK_PROFILE=regression',source,'node'];
  const refused = runDockerCheckCommand([...prefix,...studyNodeArgs({...binding,sha256:'0'.repeat(64)},'archiveRestoreInput.mjs')],{timeoutMs:10000});
  assert.equal(refused.ok,false); assert.equal(refused.exitCode,1);
  assert.deepEqual(JSON.parse(refused.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
  process.stdout.write(`${JSON.stringify({stage:'archive_binding_refusal_and_input_protection_passed',sha256:binding.sha256})}\n`);
  return (entry,args = []) => requireBoundStudyOutput(docker([...prefix,...studyNodeArgs(binding,entry,args)]),binding,entry);
}
