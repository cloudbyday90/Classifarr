/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from './check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { gatewayTlsFixture } from '../server/src/__tests__/helpers/gatewayTlsFixture.mjs';

const [image, revision] = process.argv.slice(2);
assert.match(image || '', /^sha256:[a-f0-9]{64}$/); assert.match(revision || '', /^[a-f0-9]{40}$/);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
assert.equal(JSON.parse(docker(['image', 'inspect', image]))[0].Config.Labels['org.opencontainers.image.revision'], revision);
const id = randomUUID(), label = `io.classifarr.gateway-fixture=${id}`;
const front = `cf-gateway-front-${id}`, back = `cf-gateway-back-${id}`;
const provider = `cf-gateway-provider-${id}`, application = `cf-gateway-application-${id}`;
const runSpec = createSchemaCheckRunSpec(), containers = [], networks = [];
const fixture = name => resolve('scripts/fixtures/ollamaGatewayRehearsal', name);
const address = (name, network) => JSON.parse(docker(['inspect', name]))[0].NetworkSettings.Networks[network].IPAddress;
let tls;
function remove(kind, name) {
  const item = JSON.parse(docker([kind, 'inspect', name]))[0];
  assert.equal((kind === 'container' ? item.Config.Labels : item.Labels)['io.classifarr.gateway-fixture'], id);
  docker([kind, 'rm', ...(kind === 'container' ? ['-f'] : []), name]);
}
try {
  for (const name of [front, back]) {
    networks.push(name); docker(['network', 'create', '--internal', '--label', label, name]);
    assert.equal(JSON.parse(docker(['network', 'inspect', name]))[0].Internal, true);
  }
  const command = (args, options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label')
    ? ['run', '--network', back, '--memory', '2g', '--cpus', '2', '--pids-limit', '512', ...args.slice(1)] : args, options);
  await withSchemaCheckContainer({ imageName: image, runSpec, command, action: async () => {
    const gateway = runSpec.containerName;
    docker(['network', 'connect', front, gateway]);
    for (const [name, network] of [[provider, back], [application, front]]) {
      containers.push(name);
      docker(['run', '-d', '--name', name, '--label', label, '--network', network, '--user', '1000:1000', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
        '--memory', '256m', '--cpus', '1', '--pids-limit', '64', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--entrypoint', 'node', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', image, '-e', 'setInterval(()=>{},1000)']);
      const inspect = JSON.parse(docker(['inspect', name]))[0];
      assert.equal(Object.keys(inspect.HostConfig.PortBindings || {}).length, 0);
      assert.equal(inspect.Image, image); assert.deepEqual(Object.keys(inspect.NetworkSettings.Networks), [network]);
    }
    const host = address(gateway, front), upstream = `http://${address(provider, back)}:11434`;
    tls = await gatewayTlsFixture(host);
    const credentials = ['foreground', 'background'].map(workClass => ({ installation: 'synthetic', workClass, token: randomBytes(32).toString('base64url') }));
    const common = { url: `https://${host}:11435`, upstream, models: ['synthetic:latest'], ca: tls.cert };
    await writeFile(join(tls.directory, 'gateway.json'), JSON.stringify({ gateway: { host, upstream, models: common.models, credentials,
      tls: { cert: tls.cert, key: tls.key } }, database: { host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr_gateway_network' } }), { mode: 0o600 });
    await writeFile(join(tls.directory, 'routing.json'), JSON.stringify({ revision: 1, configuration: { baseUrl: upstream, model: 'synthetic:latest' },
      foreground: { ...common, token: credentials[0].token }, background: { ...common, token: credentials[1].token } }), { mode: 0o600 });
    for (const [name, file] of [[gateway, 'gateway.json'], [application, 'routing.json']]) {
      docker(['cp', join(tls.directory, file), `${name}:/tmp/${file}`]);
      docker(['exec', '--user', '0', name, 'chown', '1000:1000', `/tmp/${file}`]);
    }
    for (const [name, file] of [[provider, 'networkProvider.mjs'], [gateway, 'networkGateway.mjs'], [application, 'networkApplication.mjs']]) {
      docker(['cp', fixture(file), `${name}:/tmp/${file}`]);
    }
    docker(['exec', '-d', provider, 'node', '/tmp/networkProvider.mjs']);
    docker(['exec', '-d', '--user', '1000:1000', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', gateway, 'node', '/tmp/networkGateway.mjs']);
    const deadline = Date.now() + 20000;
    while (true) {
      const ready = docker(['exec', gateway, 'node', '--input-type=module', '-e', 'import {connect} from "node:net";const s=connect(11435,process.argv[1]);s.setTimeout(1000,()=>s.destroy());s.on("connect",()=>{s.destroy();console.log("ready")});s.on("error",()=>{});', host]).trim();
      if (ready === 'ready') break;
      if (Date.now() > deadline) throw new Error('gateway_startup_deadline'); await delay(200);
    }
    process.stdout.write(docker(['exec', application, 'node', '/tmp/networkApplication.mjs']));
    const count = docker(['exec', provider, 'node', '--input-type=module', '-e', 'console.log((await (await fetch("http://127.0.0.1:11434/stats")).json()).attempts)']).trim();
    assert.equal(count, '1');
  } });
} finally {
  // Exact generated names plus ownership labels; no pruning or caller-supplied targets.
  const errors = [];
  for (const name of containers.reverse()) {
    try { if (docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim()) remove('container', name); } catch (error) { errors.push(error); }
  }
  for (const name of networks.reverse()) {
    try { if (docker(['network', 'ls', '-q', '--filter', `name=^${name}$`]).trim()) remove('network', name); } catch (error) { errors.push(error); }
  }
  try { await tls?.close(); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, 'gateway_network_cleanup_failed');
}
assert.equal(docker(['ps', '-aq', '--filter', `label=${label}`]).trim(), '');
assert.equal(docker(['network', 'ls', '-q', '--filter', `label=${label}`]).trim(), '');
assert.equal(docker(['ps', '-aq', '--filter', `name=^${runSpec.containerName}$`]).trim(), '');
assert.equal(existsSync(runSpec.hostDataPath), false);
process.stdout.write(`gateway_network_cleanup_verified ${id}\n`);
