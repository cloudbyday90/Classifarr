/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const ROUTING_BASELINE = 'eef03e57ffdd26d638f32f1593c424b438041ea2';
const fixture = resolve(import.meta.dirname, '../fixtures/manualRoutingRehearsal');
export function routingReceipt(output) {
  const rows = output.split(/\r?\n/).filter(line => line.startsWith('ROUTING_PROBE '));
  assert.equal(rows.length, 1, 'missing_or_duplicate_routing_receipt');
  return JSON.parse(rows[0].slice('ROUTING_PROBE '.length));
}

/** Only immutable image inputs. No existing container, data, endpoint or command override. */
export async function withRoutingRehearsal({ baseline, candidate, execute = promisify(execFile), random = randomBytes }, check) {
  for (const image of [baseline, candidate]) assert.match(image ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(baseline, candidate, 'upgrade_requires_distinct_images');
  const suffix = random(16).toString('hex'); assert.match(suffix, /^[a-f0-9]{32}$/);
  const name = `classifarr-routing-drill-${suffix}`, volume = `${name}-data`, label = `classifarr.routing-drill=${suffix}`;
  const docker = async (args, timeout = 30_000) => {
    try {
      const { stdout } = await execute('docker', args, { encoding: 'utf8', shell: false, windowsHide: true,
        timeout, maxBuffer: 1024 * 1024 });
      return stdout.trim();
    } catch (error) {
      const diagnostic = String(error.stderr ?? '').match(/^ROUTING_PROBE_FAILURE ([a-z0-9_]{1,100})$/m);
      throw new Error(diagnostic ? `routing_probe_failed:${diagnostic[1]}` : `routing_docker_failed:${args[0]}`);
    }
  };
  const containerFilter = ['--filter', `name=^/${name}$`, '--filter', `label=${label}`];
  const volumeFilter = ['--filter', `name=^${volume}$`, '--filter', `label=${label}`];
  for (const image of [baseline, candidate]) assert.equal(await docker(['image', 'inspect', '--format', '{{.Id}}', image]), image);
  assert.equal(await docker(['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', baseline]), ROUTING_BASELINE);
  assert.equal(await docker(['ps', '-aq', '--filter', `name=^/${name}$`]), '', 'routing_container_collision');
  assert.equal(await docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]), '', 'routing_volume_collision');
  const inspect = async () => JSON.parse(await docker(['inspect', '--format', '{{json .State}}', name]));
  const waitFor = async (test, timeout = 90_000) => {
    const deadline = performance.now() + timeout;
    do { if (await test()) return; await sleep(250); } while (performance.now() < deadline);
    throw new Error('routing_wait_timeout');
  };
  const healthy = () => waitFor(async () => {
    const state = await inspect(); assert.equal(state.Running, true, 'routing_startup_failed');
    return state.Health?.Status === 'healthy';
  }, 180_000);
  const removeContainer = async () => {
    const owned = await docker(['ps', '-aq', ...containerFilter]);
    if (owned) await docker(['rm', '--force', name]);
    assert.equal(await docker(['ps', '-aq', '--filter', `name=^/${name}$`]), '', 'routing_container_cleanup_failed');
  };
  const start = async image => {
    assert([baseline, candidate].includes(image));
    await docker(['create', '--name', name, '--label', label, '--network', 'none', '--restart', 'no',
      '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '2g', '--cpus', '2', '--pids-limit', '128',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--tmpfs', '/run/postgresql:rw,nosuid,size=8m,uid=1000,gid=1000',
      '--mount', `type=volume,source=${volume},target=/app/data`,
      '--mount', `type=bind,source=${fixture},target=/app/routing-fixture,readonly`,
      '--env', 'CLASSIFARR_ROUTING_REHEARSAL=disposable-v1', '--env', 'POSTGRES_HOST=localhost',
      '--env', 'POSTGRES_PORT=5432', '--env', 'POSTGRES_DB=classifarr', '--env', 'POSTGRES_USER=classifarr',
      '--env', 'LOG_LEVEL=error', '--env', 'FILE_LOGGING_ENABLED=false', '--env', 'NODE_OPTIONS=--max-old-space-size=1024',
      '--health-cmd', 'curl --fail --max-time 2 --silent http://127.0.0.1:21324/health',
      '--health-interval', '1s', '--health-timeout', '3s', '--health-start-period', '120s', image]);
    await docker(['start', name]); await healthy();
  };
  let result, failure;
  try {
    await docker(['volume', 'create', '--label', label, volume]);
    result = await check({ name, baseline, candidate, docker, start, healthy, inspect, waitFor, removeContainer,
      probe: async phase => routingReceipt(await docker(['exec', name, 'node', '/app/routing-fixture/probe.mjs', phase])),
      provider: () => docker(['exec', '--detach', name, 'node', '/app/routing-fixture/provider.mjs']),
    });
  } catch (error) { failure = error; }
  try {
    await removeContainer();
    const owned = await docker(['volume', 'ls', '-q', ...volumeFilter]);
    if (owned) { assert.equal(owned, volume); await docker(['volume', 'rm', volume]); }
    assert.equal(await docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]), '', 'routing_volume_cleanup_failed');
  } catch { throw new Error(`routing_cleanup_failed:${name}`); }
  if (failure) throw failure;
  return { ...result, cleanup: 'passed' };
}
