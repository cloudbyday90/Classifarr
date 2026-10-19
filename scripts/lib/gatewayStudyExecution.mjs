/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyRecords } from './gatewayStudyPolicy.mjs';
import { assertStudyVolumes,verifyStudyInputProtection } from './gatewayStudyInputs.mjs';

const records = output => output.trim().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
export function createStudyExecution({docker,source,binding,stores,inspect,report}) {
  const {profile,study} = binding.manifest;
  const prefix = ['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
    '-e',`CLASSIFARR_SOAK_PROFILE=${profile}`,source,'node'];
  assertStudyVolumes(inspect(source),stores,true); verifyStudyInputProtection(docker,source);
  // Real refusal occurs before setup creates any synthetic SQL state.
  const refused = runDockerCheckCommand([...prefix,...studyNodeArgs({...binding,sha256:'0'.repeat(64)},'soakData.mjs',['setup'])],{timeoutMs:10000});
  assert.equal(refused.ok,false); assert.equal(refused.exitCode,1);
  assert.deepEqual(records(refused.stdout),[{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'}]);
  report({stage:'study_binding_refusal_and_input_protection_passed',study,sha256:binding.sha256});
  return {
    execFixture:(entry,args = [],options = {}) => runDockerCheckCommand([...prefix,...studyNodeArgs(binding,entry,args)],options),
    fixture:(action,...args) => requireBoundStudyRecords(records(docker([...prefix,...studyNodeArgs(binding,'soakData.mjs',[action,...args])])),binding,'soakData.mjs'),
    read(path) {
      assert.ok(['/results/soak-result.json','/results/soak-archives.json','/results/soak-after.json',
        '/results/inference-binding.json','/results/binding-failed.json'].includes(path));
      return JSON.parse(docker(['exec','--user','1000:1000',source,'node','--input-type=module','-e',
        'import{open}from"node:fs/promises";import{constants}from"node:fs";let f;try{f=await open(process.argv[1],constants.O_RDONLY|constants.O_NOFOLLOW);const s=await f.stat();if(!s.isFile()||s.size>262144)throw Error("study_result_size");console.log(await f.readFile("utf8"))}catch(e){if(e.code!=="ENOENT")throw e;console.log("null")}finally{await f?.close()}',path]));
    },
  };
}
