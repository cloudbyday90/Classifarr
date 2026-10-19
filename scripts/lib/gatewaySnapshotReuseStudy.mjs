/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createSchemaCheckRunSpec,withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { finishGatewayStudyCleanup } from './gatewayStudyCleanup.mjs';
import { bindStudySources } from './gatewayStudyBinding.mjs';
import { stageStudyInputs,assertStudyFixtureVolume,verifyStudyFixtureProtection } from './gatewayStudyInputs.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyOutput } from './gatewayStudyPolicy.mjs';

export function assertSnapshotStudySource(value,image,volume) {
  assert.equal(value.Image,image); assertStudyFixtureVolume(value,volume);
  const host = value.HostConfig;
  assert.equal(host.NetworkMode,'none'); assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.equal(host.Memory,2147483648); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,2000000000); assert.equal(host.PidsLimit,512);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.equal(value.Mounts.length,2);
  const data = value.Mounts.filter(item => item.Destination === '/app/data');
  assert.equal(data.length,1); assert.equal(data[0].Type,'bind'); assert.equal(data[0].RW,true);
}

/** Fresh production-entrypoint DB, no network/provider/restore authority. */
export async function runGatewaySnapshotReuseStudy(image,revision) {
  assert.match(image,/^sha256:[a-f0-9]{64}$/); assert.match(revision,/^[a-f0-9]{40}$/);
  const docker = args => execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:1048576});
  assert.equal(JSON.parse(docker(['image','inspect',image]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
  const bind = () => bindStudySources({image,revision,study:'snapshot',profile:'regression'}), binding = bind();
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const volume = `classifarr-snapshot-fixtures-${suffix}`, stager = `classifarr-snapshot-stager-${suffix}`;
  const key = 'io.classifarr.snapshot-study', label = `${key}=${suffix}`, entry = 'snapshotReuseStudy.mjs';
  const inspect = name => JSON.parse(docker(['inspect',name]))[0];
  const remove = name => {
    if (docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) {
      assert.equal(inspect(name).Config.Labels[key],suffix); docker(['rm','-f',name]);
    }
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
  };
  const command = (args,options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run','--label',label,'--network','none','--memory','2g','--memory-swap','2g','--cpus','2','--pids-limit','512',
    '--mount',`type=volume,source=${volume},target=/fixtures,readonly`,...args.slice(1)] : args,options);
  try {
    assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
    docker(['volume','create','--label',label,volume]);
    stageStudyInputs({docker,image,binding,name:stager,label,stores:{fixtures:volume},inspect,remove});
    assert.deepEqual(bind(),binding);
    await withSchemaCheckContainer({imageName:image,runSpec:spec,command,action:async () => {
      const source = spec.containerName; assertSnapshotStudySource(inspect(source),image,volume);
      verifyStudyFixtureProtection(docker,source,entry);
      const prefix = ['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
        '-e','CLASSIFARR_SOAK_PROFILE=regression',source,'node'];
      const refused = runDockerCheckCommand([...prefix,...studyNodeArgs({...binding,sha256:'0'.repeat(64)},entry,['setup'])],{timeoutMs:10000});
      assert.equal(refused.ok,false); assert.equal(refused.exitCode,1);
      assert.deepEqual(JSON.parse(refused.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
      for (const action of ['setup','small','wide','probes','restart']) {
        const body = requireBoundStudyOutput(docker([...prefix,...studyNodeArgs(binding,entry,[action])]),binding,entry);
        if (action !== 'setup') {
          const rows = body.trim().split('\n').map(JSON.parse), last = rows.at(-1);
          assert.equal(last.fixture,'snapshot-reuse-complete'); assert.equal(last.action,action);
          assert.equal(last.preserved,true); assert.equal(last.purgeAuthorized,false); assert.equal(last.productionAuthorized,false);
        } else assert.equal(body,'');
        process.stdout.write(body);
      }
      assert.equal(inspect(source).State.OOMKilled,false);
    }});
  } finally {
    finishGatewayStudyCleanup([
      {name:'committed-inputs',run:() => assert.deepEqual(bind(),binding)},
      {name:stager,run:() => remove(stager)},
      {name:volume,run:() => {
        if (docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim()) {
          assert.equal(JSON.parse(docker(['volume','inspect',volume]))[0].Labels[key],suffix); docker(['volume','rm',volume]);
        }
        assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
      }},
      {name:'snapshot-labeled-containers',run:() => assert.equal(docker(['ps','-aq','--filter',`label=${label}`]).trim(),'')},
      {name:'snapshot-labeled-volumes',run:() => assert.equal(docker(['volume','ls','-q','--filter',`label=${label}`]).trim(),'')},
      {name:'disposable-data-directory',run:() => assert.equal(existsSync(spec.hostDataPath),false)},
    ]);
  }
  process.stdout.write('snapshot_reuse_study_cleanup_verified\n');
}
