/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { withSchemaCheckContainer, createSchemaCheckRunSpec } from './check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { gatewayTlsFixture } from '../server/src/__tests__/helpers/gatewayTlsFixture.mjs';

const [imageName, revision] = process.argv.slice(2);
if (!/^sha256:[a-f0-9]{64}$/.test(imageName || '') || !/^[a-f0-9]{40}$/.test(revision || '')) {
  throw new Error('Usage: node scripts/run-ollama-gateway-rehearsal.mjs <immutable-image-id> <source-sha>');
}
const docker = args => execFileSync('docker',args,{ encoding: 'utf8',windowsHide: true,timeout: 120000 });
assert.equal(JSON.parse(docker(['image','inspect',imageName]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
const runSpec = createSchemaCheckRunSpec();
const command = (args,options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label')
  ? ['run','--network','none','--memory','2g','--cpus','2','--pids-limit','512',...args.slice(1)] : args,options);
await withSchemaCheckContainer({ imageName,runSpec,command,action: async () => {
  const name = runSpec.containerName, container = JSON.parse(docker(['inspect',name]))[0];
  assert.equal(container.Config.Labels['io.classifarr.role'],'schema-snapshot-check');
  assert.equal(container.HostConfig.NetworkMode,'none'); assert.equal(container.Image,imageName);
  assert.equal(Object.keys(container.HostConfig.PortBindings || {}).length,0);
  // Generate disposable TLS material on the host: the runtime image intentionally has no openssl CLI.
  const tls = await gatewayTlsFixture();
  try {
    execFileSync('docker',['exec','-i','--user','1000:1000',name,'node','--input-type=module','-e',
      'import {writeFile} from "node:fs/promises";const parts=[];for await(const p of process.stdin)parts.push(p);await writeFile("/tmp/upstream-test-tls.json",Buffer.concat(parts),{mode:0o600,flag:"wx"});'],
    { input: JSON.stringify({ cert: tls.cert,key: tls.key }),windowsHide: true,timeout: 10000,stdio: ['pipe','pipe','pipe'] });
  } finally { await tls.close(); }
  docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/probe.mjs'),`${name}:/tmp/gateway-probe.mjs`]);
  docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/application.mjs'),`${name}:/tmp/application.mjs`]);
  docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/recovery.mjs'),`${name}:/tmp/recovery.mjs`]);
  docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/offlineRecovery.mjs'),`${name}:/tmp/offlineRecovery.mjs`]);
  for (const source of ['scripts/fixtures/ollamaGatewayRehearsal/providerStop.mjs',
    'scripts/fixtures/ollamaGatewayRehearsal/archive.mjs',
    'scripts/fixtures/ollamaGatewayRehearsal/upstreamIdentity.mjs',
    'server/src/__tests__/helpers/dockerStopFixture.mjs','server/src/__tests__/helpers/dockerBoundaryFixture.mjs']) {
    docker(['cp',resolve(source),`${name}:/tmp/${source.split('/').at(-1)}`]);
  }
  const result = docker(['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',name,'node','/tmp/gateway-probe.mjs']);
  process.stdout.write(result);
} });
assert.equal(docker(['ps','-aq','--filter',`name=^${runSpec.containerName}$`]).trim(),'');
assert.equal(existsSync(runSpec.hostDataPath),false);
process.stdout.write(`gateway_rehearsal_cleanup_verified ${runSpec.containerName}\n`);
