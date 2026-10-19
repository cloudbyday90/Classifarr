/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createSchemaCheckRunSpec,withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { finishGatewayStudyCleanup } from './gatewayStudyCleanup.mjs';
import { bindStudySources } from './gatewayStudyBinding.mjs';
import { stageStudyInputs } from './gatewayStudyInputs.mjs';
import { createSchedulingExecution,assertSchedulingVerification } from './gatewaySchedulingExecution.mjs';
import { createSchedulingVerifier,assertSchedulingSandbox,assertSchedulingSource } from './gatewaySchedulingSandbox.mjs';
import { runSchedulingScenarios } from './gatewaySchedulingScenarios.mjs';

export async function runGatewayCatalogSchedulingRehearsal(image,revision,rotationStudy = false) {
  assert.equal(typeof rotationStudy,'boolean');
  assert.match(image,/^sha256:[a-f0-9]{64}$/); assert.match(revision,/^[a-f0-9]{40}$/);
  const docker = args => execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:1048576});
  assert.equal(JSON.parse(docker(['image','inspect',image]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
  const bind = () => bindStudySources({image,revision,study:'scheduling',profile:rotationStudy ? 'rotation' : 'regression'}), binding = bind();
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const stores = Object.fromEntries(['archives','receipts','catalogs','fixtures'].map(kind => [kind,`classifarr-schedule-${kind}-${suffix}`]));
  const names = ['classifarr-schedule-verify-','classifarr-schedule-catalog-verify-'].map(prefix => `${prefix}${suffix}`);
  const stager = `classifarr-schedule-stager-${suffix}`, key = 'io.classifarr.archive-rehearsal', label = `${key}=${suffix}`;
  const inspect = name => JSON.parse(docker(['inspect',name]))[0];
  const remove = name => {
    if (docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) {
      assert.equal(inspect(name).Config.Labels[key],suffix); docker(['rm','-f',name]);
    }
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
  };
  const command = (args,options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run','--network','none','--memory','2g','--memory-swap','2g','--cpus','2','--pids-limit','512',
    ...Object.entries(stores).flatMap(([kind,volume]) => ['--mount',`type=volume,source=${volume},target=/${kind}${kind === 'fixtures' ? ',readonly' : ''}`]),
    ...args.slice(1)] : args,options);
  try {
    for (const volume of Object.values(stores)) {
      assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
      docker(['volume','create','--label',label,volume]);
    }
    stageStudyInputs({docker,image,binding,name:stager,label,stores,inspect,remove});
    assert.deepEqual(bind(),binding);
    await withSchemaCheckContainer({imageName:image,runSpec:spec,command,action:async () => {
      const source = spec.containerName;
      assertSchedulingSource(inspect(source),{image,stores});
      docker(['exec','--user','0:0',source,'chown','1000:1000','/archives','/receipts','/catalogs']);
      docker(['exec','--user','0:0',source,'chmod','700','/archives','/receipts','/catalogs']);
      const fixture = createSchedulingExecution({docker,source,binding,stores,inspect});
      for (const [index,name] of names.entries()) {
        assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
        createSchedulingVerifier({docker,inspect,image,stores,name,label,catalog:index === 1});
      }
      const verify = index => {
        const expected = {image,stores,catalog:index === 1};
        assertSchedulingSandbox(inspect(names[index]),expected);
        const output = docker(['start','-a',names[index]]), value = inspect(names[index]);
        assertSchedulingSandbox(value,expected); assertSchedulingVerification(output,value);
      };
      runSchedulingScenarios({fixture,verify,rotationStudy});
    }});
  } finally {
    finishGatewayStudyCleanup([
      {name:'committed-inputs',run:() => assert.deepEqual(bind(),binding)},
      ...[stager,...names].map(name => ({name,run:() => remove(name)})),
      ...Object.values(stores).map(volume => ({name:volume,run:() => {
        if (docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim()) {
          assert.equal(JSON.parse(docker(['volume','inspect',volume]))[0].Labels[key],suffix); docker(['volume','rm',volume]);
        }
        assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
      }})),
      {name:'schedule-labeled-containers',run:() => assert.equal(docker(['ps','-aq','--filter',`label=${label}`]).trim(),'')},
      {name:'schedule-labeled-volumes',run:() => assert.equal(docker(['volume','ls','-q','--filter',`label=${label}`]).trim(),'')},
      {name:'disposable-data-directory',run:() => assert.equal(existsSync(spec.hostDataPath),false)},
    ]);
  }
  process.stdout.write('catalog_scheduling_rehearsal_cleanup_verified\n');
}
