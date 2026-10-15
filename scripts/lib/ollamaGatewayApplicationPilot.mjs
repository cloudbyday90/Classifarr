/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { waitForContainerReady } from './containerReadiness.mjs';

export function pilotRunArguments(args, front, routed = false) {
  assert.match(front, /^cf-gateway-front-[a-f0-9-]{36}$/);
  assert.equal(args[0], 'run');
  assert.ok(args.includes('--label'));
  return ['run', '--network', front, '--memory', '2g', '--cpus', '2', '--pids-limit', '512',
    '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated',
    ...(routed ? ['-e', 'CLASSIFARR_OLLAMA_ROUTING_FILE=/app/data/gateway-pilot-routing.json'] : []), ...args.slice(1)];
}

/** Called only within the owned network rehearsal; never accepts live data paths. */
export async function rehearseFullApplication({ image, front, gateway, routing, docker }) {
  assert.match(gateway, /^classifarr-schema-check-[a-f0-9-]{36}$/);
  const gatewayContainer = JSON.parse(docker(['inspect', gateway]))[0];
  assert.equal(gatewayContainer.Config.Labels['io.classifarr.role'], 'schema-snapshot-check');
  assert.equal(gatewayContainer.Image, image);
  assert.ok(gatewayContainer.NetworkSettings.Networks[front]);
  const runSpec = createSchemaCheckRunSpec();
  const ledgerSnapshot = () => docker(['exec', gateway, 'node', '--input-type=module', '-e',
    'import pg from "/app/node_modules/pg/lib/index.js";const c=new pg.Client({host:"/var/run/postgresql",user:"classifarr",database:"classifarr_gateway_network"});await c.connect();console.log(JSON.stringify((await c.query("SELECT * FROM ollama_gateway.admission")).rows));await c.end();']).trim();
  let initialArgs, stage = 'startup';
  const command = (args, options) => {
    if (args[0] !== 'run' || !args.includes('--label')) return runDockerCheckCommand(args, options);
    initialArgs = args;
    return runDockerCheckCommand(pilotRunArguments(args, front), options);
  };
  const write = async (target, bytes) => execFileSync('docker', ['exec', '-i', '--user', '1000:1000', runSpec.containerName,
    'node', '--input-type=module', '-e',
    'import {writeFile,chmod} from "node:fs/promises";const chunks=[];for await(const c of process.stdin)chunks.push(c);await writeFile(process.argv[1],Buffer.concat(chunks),{mode:0o600});await chmod(process.argv[1],0o600);', target],
  { input: bytes, windowsHide: true, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 65536 });
  const probe = async phase => {
    stage = phase;
    for (const file of ['fullApplication.mjs', 'pilotHttp.mjs']) {
      await write(`/tmp/${file}`, await readFile(resolve('scripts/fixtures/ollamaGatewayRehearsal', file)));
    }
    docker(['exec', '--user', '1000:1000', runSpec.containerName, 'node', '/tmp/fullApplication.mjs', phase]);
    process.stdout.write(`gateway_full_application_${phase}_passed\n`);
  };
  const replace = async () => {
    stage = 'replacement';
    const before = JSON.parse(docker(['inspect', runSpec.containerName]))[0];
    assert.equal(before.Config.Labels['io.classifarr.role'], 'schema-snapshot-check');
    assert.equal(before.Image, image);
    docker(['stop', '--time', '30', runSpec.containerName]);
    docker(['rm', runSpec.containerName]);
    assert.ok(runDockerCheckCommand(pilotRunArguments(initialArgs, front, true), { timeoutMs: 120000 }).ok,
      'pilot_replacement_failed');
    await waitForContainerReady(runSpec.containerName);
    const after = JSON.parse(docker(['inspect', runSpec.containerName]))[0];
    assert.notEqual(after.Id, before.Id);
    assert.equal(after.Image, image);
    assert.equal(after.State.OOMKilled, false);
    assert.equal(Object.keys(after.HostConfig.PortBindings || {}).length, 0);
    assert.deepEqual(Object.keys(after.NetworkSettings.Networks), [front]);
  };
  try {
    await withSchemaCheckContainer({ imageName: image, runSpec, command, action: async () => {
      await write('/app/data/gateway-pilot-routing.json', await readFile(routing));
      await probe('seed');
      await replace();
      await probe('active');
      const before = ledgerSnapshot();
      // Fixture-only outage; finally always restores the exact owned gateway.
      try { docker(['pause', gateway]); await probe('unavailable'); }
      finally { docker(['unpause', gateway]); }
      await replace();
      await probe('replaced');
      assert.equal(ledgerSnapshot(), before, 'pilot_reads_changed_admission');
    } });
  } catch {
    // Subprocess assertions may contain cookies/configuration; publish fixed classification only.
    throw new Error(`gateway_full_application_pilot_failed:${stage}`);
  } finally {
    assert.equal(docker(['ps', '-aq', '--filter', `name=^${runSpec.containerName}$`]).trim(), '', `cleanup_required:${runSpec.containerName}`);
    assert.equal(existsSync(runSpec.hostDataPath), false, `cleanup_required:${runSpec.hostDataPath}`);
  }
  process.stdout.write('gateway_full_application_cleanup_verified\n');
}
