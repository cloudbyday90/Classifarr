/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { observeDockerProviderBoundary } from '../server/src/ollamaGateway/dockerBoundaryObserver.mjs';
import { dockerBoundaryConfiguration } from '../server/src/ollamaGateway/dockerBoundaryContract.mjs';
import { rehearseDockerStop } from './fixtures/ollamaGatewayRehearsal/dockerStop.mjs';

const [image,revision,endpoint,...extra] = process.argv.slice(2);
assert.equal(extra.length,0); assert.match(image || '',/^sha256:[a-f0-9]{64}$/); assert.match(revision || '',/^[a-f0-9]{40}$/);
const socketPath = endpoint?.startsWith('unix:///') ? endpoint.slice(7)
  : endpoint?.startsWith('npipe:////./pipe/') ? `\\\\.\\pipe\\${endpoint.slice('npipe:////./pipe/'.length)}` : null;
dockerBoundaryConfiguration({ socketPath,daemonIdHash: 'a'.repeat(64),containerId: 'b'.repeat(64),imageId: image,startedAt: '2026-10-14T00:00:00Z' });
const docker = args => {
  const result = runDockerCheckCommand(['--host',endpoint,...args],{ timeoutMs: 30000 });
  if (!result.ok) throw new Error('docker_boundary_fixture_command_failed');
  return result.stdout;
};
assert.equal(JSON.parse(docker(['image','inspect',image]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
const id = randomUUID(),name = `cf-docker-boundary-${id}`,label = `io.classifarr.boundary-fixture=${id}`;
const owned = () => {
  const inspect = JSON.parse(docker(['container','inspect',name]))[0];
  assert.equal(inspect.Config.Labels['io.classifarr.boundary-fixture'],id); assert.equal(inspect.Image,image);
  return inspect;
};
try {
  docker(['run','-d','--pull','never','--name',name,'--label',label,'--network','none','--restart','no',
    '--user','1000:1000','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--memory','256m','--cpus','1','--pids-limit','64',
    '--cap-drop','ALL','--security-opt','no-new-privileges','--ipc','private','--cgroupns','private','--entrypoint','node',
    image,'-e','setInterval(()=>{},1000)']);
  const initial = owned();
  assert.equal(initial.HostConfig.NetworkMode,'none'); assert.equal(Object.keys(initial.HostConfig.PortBindings || {}).length,0);
  assert.equal(initial.Mounts.length,0);
  const config = { socketPath,daemonIdHash: createHash('sha256').update(docker(['info','--format','{{.ID}}']).trim()).digest('hex'),
    containerId: initial.Id,imageId: image,startedAt: initial.State.StartedAt };
  assert.equal((await observeDockerProviderBoundary(config)).observation,'not_stopped');
  for (const [source,target] of [
    ['server/src/__tests__/helpers/dockerBoundaryFixture.mjs','dockerBoundaryFixture.mjs'],
    ['scripts/fixtures/ollamaGatewayRehearsal/dockerBoundary.mjs','dockerBoundary.mjs'],
  ]) {
    execFileSync('docker',['--host',endpoint,'exec','-i',name,'node','--input-type=module','-e',
      'import {writeFile} from "node:fs/promises";const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);await writeFile(process.argv[1],Buffer.concat(chunks),{mode:0o600,flag:"wx"});',`/tmp/${target}`],
    { input: await readFile(source),windowsHide: true,timeout: 10000,stdio: ['pipe','pipe','pipe'] });
  }
  process.stdout.write(docker(['exec',name,'node','/tmp/dockerBoundary.mjs']));
  owned(); docker(['stop','--time','3',name]);
  const stopped = await observeDockerProviderBoundary(config);
  assert.equal(stopped.observation,'stopped'); assert.equal(stopped.recoveryAuthorized,false);
  assert.deepEqual(stopped.snapshot.concerns,[]);
  owned(); docker(['start',name]);
  const restarted = await observeDockerProviderBoundary(config);
  assert.equal(restarted.observation,'changed'); assert.equal(restarted.recoveryAuthorized,false);
  process.stdout.write('real_docker_boundary_passed running stopped restart_pin_refused zero_provider_calls\n');
} finally {
  if (docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) { owned(); docker(['rm','-f',name]); }
}
assert.equal(docker(['ps','-aq','--filter',`label=${label}`]).trim(),'');
process.stdout.write(`docker_boundary_cleanup_verified ${name}\n`);
await rehearseDockerStop({ docker,image,socketPath });
