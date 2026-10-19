/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createSchemaCheckRunSpec,withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { bindStudySources } from './gatewayStudyBinding.mjs';
import { stageStudyInputs } from './gatewayStudyInputs.mjs';
import { finishGatewayStudyCleanup } from './gatewayStudyCleanup.mjs';
import { createArchiveExecution } from './gatewayArchiveExecution.mjs';
import { runGatewayArchiveScenarios } from './gatewayArchiveScenarios.mjs';
import { runGatewayCatalogRehearsal } from './gatewayCatalogRehearsal.mjs';
import { runGatewayCatalogRetentionRehearsal } from './gatewayCatalogRetentionRehearsal.mjs';

const docker = args => execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:1048576});

/** Fixed local-only default scenarios. No caller-supplied stores or credentials. */
export async function runGatewayArchiveRehearsal(image,revision) {
  assert.match(image,/^sha256:[a-f0-9]{64}$/); assert.match(revision,/^[a-f0-9]{40}$/);
  assert.equal(JSON.parse(docker(['image','inspect',image]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
  const bind = () => bindStudySources({image,revision,study:'archive',profile:'regression'}), binding = bind();
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const key = 'io.classifarr.archive-rehearsal', label = `${key}=${suffix}`;
  const stores = Object.fromEntries(['archives','receipts','catalogs','fixtures'].map(kind => [kind,`cf-archive-${kind}-${suffix}`]));
  const names = Object.fromEntries(['stager','verifier','catalog','retention'].map(kind => [kind,`cf-archive-${kind}-${suffix}`]));
  const inspect = name => JSON.parse(docker(['inspect',name]))[0];
  const remove = name => {
    if (!docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) return;
    assert.equal(inspect(name).Config.Labels[key],suffix); docker(['rm','-f',name]);
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
  };
  const command = (args,options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run','--network','none','--memory','2g','--memory-swap','2g','--cpus','2','--pids-limit','512',
    '--tmpfs','/input-quota:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
    ...Object.entries(stores).flatMap(([kind,volume]) => ['--mount',`type=volume,source=${volume},target=/${kind}${kind === 'fixtures' ? ',readonly' : ''}`]),
    ...args.slice(1)] : args,options);
  try {
    for (const volume of Object.values(stores)) {
      assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
      docker(['volume','create','--label',label,volume]);
    }
    stageStudyInputs({docker,image,binding,name:names.stager,label,stores,inspect,remove});
    assert.deepEqual(bind(),binding);
    await withSchemaCheckContainer({imageName:image,runSpec:spec,command,action:async () => {
      const source = spec.containerName, value = inspect(source), host = value.HostConfig;
      assert.equal(value.Image,image); assert.equal(host.NetworkMode,'none'); assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
      assert.equal(host.Memory,2147483648); assert.equal(host.MemorySwap,host.Memory);
      assert.equal(host.NanoCpus,2000000000); assert.equal(host.PidsLimit,512);
      assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.equal(value.Mounts.length,5);
      assert.equal(host.Tmpfs['/input-quota'],'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev');
      for (const [kind,volume] of Object.entries(stores)) {
        const mounts = value.Mounts.filter(item => item.Destination === `/${kind}`);
        assert.equal(mounts.length,1); assert.equal(mounts[0].Type,'volume');
        assert.equal(mounts[0].Name,volume); assert.equal(mounts[0].RW,kind !== 'fixtures');
      }
      const data = value.Mounts.filter(item => item.Destination === '/app/data');
      assert.equal(data.length,1); assert.equal(data[0].Type,'bind'); assert.equal(data[0].RW,true);
      const paths = ['/archives','/receipts','/catalogs'];
      docker(['exec','--user','0:0',source,'chown','1000:1000',...paths]);
      docker(['exec','--user','0:0',source,'chmod','700',...paths]);
      const execute = createArchiveExecution({docker,source,binding,stores,inspect});
      const context = {docker,image,source,stores,binding,label,names,inspect,remove,execute};
      runGatewayArchiveScenarios(context); runGatewayCatalogRehearsal(context); runGatewayCatalogRetentionRehearsal(context);
    }});
  } finally {
    finishGatewayStudyCleanup([
      {name:'committed-inputs',run:() => assert.deepEqual(bind(),binding)},
      ...Object.values(names).map(name => ({name,run:() => remove(name)})),
      ...Object.values(stores).map(volume => ({name:volume,run:() => {
        if (docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim()) {
          assert.equal(JSON.parse(docker(['volume','inspect',volume]))[0].Labels[key],suffix); docker(['volume','rm',volume]);
        }
        assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
      }})),
      {name:'archive-labeled-containers',run:() => assert.equal(docker(['ps','-aq','--filter',`label=${label}`]).trim(),'')},
      {name:'archive-labeled-volumes',run:() => assert.equal(docker(['volume','ls','-q','--filter',`label=${label}`]).trim(),'')},
      {name:'disposable-data-directory',run:() => assert.equal(existsSync(spec.hostDataPath),false)},
    ]);
    process.stdout.write('online_archive_rehearsal_cleanup_verified\n');
  }
  process.stdout.write('online_archive_rehearsal_passed: committed sealed inputs; online SELECT-only exports; isolated restricted restore; full candidate-page proof; inventory tamper and legacy receipt refusal; UUIDv7 jobs; restarted services; mixed v3/v4 rotation to 2; corruption refusal; live history unchanged; zero provider calls\n');
}
