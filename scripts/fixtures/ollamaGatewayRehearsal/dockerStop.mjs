/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { createDockerStopClient } from '../../../server/src/ollamaGateway/dockerStopClient.mjs';
import { readDockerStopBoundary } from '../../../server/src/ollamaGateway/dockerStopBoundary.mjs';

/** Real daemon + owned idle container; no application DB, model or inference. */
export async function rehearseDockerStop({ docker,image,socketPath }) {
  const id = randomUUID(),name = `cf-provider-stop-${id}`,network = `${name}-net`,labelKey = 'io.classifarr.stop-fixture';
  const label = `${labelKey}=${id}`;
  const owned = () => {
    const value = JSON.parse(docker(['container','inspect',name]))[0];
    assert.equal(value.Config.Labels[labelKey],id); assert.equal(value.Image,image); return value;
  };
  const ownedNetwork = () => {
    const value = JSON.parse(docker(['network','inspect',network]))[0];
    assert.equal(value.Labels[labelKey],id); return value;
  };
  try {
    docker(['network','create','--driver','bridge','--internal','--opt','com.docker.network.bridge.gateway_mode_ipv4=isolated','--label',label,network]);
    const networkId = ownedNetwork().Id;
    docker(['run','-d','--pull','never','--name',name,'--label',label,'--label','io.classifarr.gateway.lifecycle=offline-v1',
      '--network',network,'--restart','no','--user','1000:1000','--read-only','--memory','256m','--cpus','1','--pids-limit','64',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--ipc','private','--cgroupns','private','--entrypoint','node',
      image,'-e','process.on("SIGTERM",()=>process.exit(0));setInterval(()=>{},1000)']);
    const initial = owned(); assert.equal(initial.Mounts.length,0);
    const config = { networkId,boundary: { socketPath,containerId: initial.Id,imageId: image,startedAt: initial.State.StartedAt,
      daemonIdHash: createHash('sha256').update(docker(['info','--format','{{.ID}}']).trim()).digest('hex') } };
    const signal = AbortSignal.timeout(40000),read = createDockerStopClient(config,signal);
    const before = await readDockerStopBoundary(config,read,signal); assert.equal(before.observation,'not_stopped');
    await read('stop');
    const after = await readDockerStopBoundary(config,read,signal);
    assert.equal(after.observation,'stopped'); assert.equal(after.pid,0);
    assert.equal(after.configurationHash,before.configurationHash); assert.equal(after.networkHash,before.networkHash);
    assert.equal(after.startedAt,before.startedAt); assert.equal(after.restartCount,before.restartCount);
    await assert.rejects(read('stop'),/gateway_stop_operation_refused/);
    process.stdout.write('real_provider_stop_passed isolated_network fixed_stop pinned_epoch stable_configuration zero_inference\n');
  } finally {
    if (docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) { owned(); docker(['rm','-f',name]); }
    if (docker(['network','ls','-q','--filter',`name=^${network}$`]).trim()) { ownedNetwork(); docker(['network','rm',network]); }
  }
  assert.equal(docker(['ps','-aq','--filter',`label=${label}`]).trim(),'');
  assert.equal(docker(['network','ls','-q','--filter',`label=${label}`]).trim(),'');
  process.stdout.write(`provider_stop_cleanup_verified ${name}\n`);
}
