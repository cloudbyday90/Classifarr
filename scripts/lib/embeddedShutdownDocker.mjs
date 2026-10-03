/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const fixture = resolve(import.meta.dirname, '../fixtures/embeddedShutdown');

export async function withShutdownContainer(check, { imageName = process.env.IMAGE_NAME || 'classifarr:test',
  execute = promisify(execFile), random = randomBytes, fixtureMode = 'http' } = {}) {
  assert(['http', 'queue'].includes(fixtureMode), 'unsupported_shutdown_fixture');
  assert.match(imageName, /^[a-zA-Z0-9][a-zA-Z0-9_./:@-]{0,254}$/);
  const suffix = random(16).toString('hex');
  assert.match(suffix, /^[a-f0-9]{32}$/);
  const name = `classifarr-stop-drill-${suffix}`, volume = `${name}-data`, offline = `${name}-offline`;
  const label = `classifarr.shutdown-drill=${suffix}`;
  const docker = async (args, timeout = 30_000) => {
    const { stdout } = await execute('docker', args, { encoding: 'utf8', shell: false,
      windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024 });
    return stdout.trim();
  };
  // An existing tag is resolved once; all startup and offline checks use this ID.
  const image = await docker(['image', 'inspect', '--format', '{{.Id}}', imageName]);
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  for (const container of [name, offline]) {
    assert.equal(await docker(['ps', '-aq', '--filter', `name=^/${container}$`]), '', 'shutdown_drill_collision');
  }
  assert.equal(await docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]), '', 'shutdown_drill_collision');
  const inspect = async () => JSON.parse(await docker(['inspect', '--format', '{{json .State}}', name]));
  const query = text => docker(['exec', name, 'psql', '-X', '-U', 'classifarr', '-d', 'classifarr', '-At', '-v', 'ON_ERROR_STOP=1', '-c', text]);
  const readReceipt = kind => {
    assert(['ready', 'http'].includes(kind), 'unsupported_shutdown_receipt');
    return docker(['exec', name, 'node', '--input-type=module', '-e',
    `import { readFileSync } from 'node:fs';
try { process.stdout.write(readFileSync('/app/data/shutdown-failure.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error;
  try { process.stdout.write(readFileSync('/app/data/shutdown-${kind}.json', 'utf8')); }
  catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
}`]);
  };
  const waitFor = async (checkReady, timeout = 180_000) => {
    const deadline = performance.now() + timeout;
    do {
      const value = await checkReady();
      if (value) return value;
      await sleep(200);
    } while (performance.now() < deadline);
    throw new Error('shutdown_drill_wait_timeout');
  };
  const healthy = () => waitFor(async () => {
    const state = await inspect();
    assert.equal(state.Running, true, 'shutdown_drill_startup_failed');
    return state.Health?.Status === 'healthy';
  });
  let result, failure;
  try {
    await docker(['volume', 'create', '--label', label, volume]);
    await docker(['create', '--name', name, '--label', label, '--network', 'none', '--restart', 'no',
      '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '2g', '--cpus', '2', '--pids-limit', '128',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--tmpfs', '/run/postgresql:rw,nosuid,size=8m,uid=1000,gid=1000',
      '--mount', `type=volume,source=${volume},target=/app/data`,
      '--mount', `type=bind,source=${fixture},target=/app/shutdown-fixture,readonly`,
      '--env', 'CLASSIFARR_SHUTDOWN_DRILL=disposable-v1',
      '--env', `NODE_OPTIONS=--max-old-space-size=1024 --import=/app/shutdown-fixture/${fixtureMode === 'queue' ? 'queue-preload' : 'preload'}.mjs`,
      '--health-cmd', 'curl --fail --max-time 2 --silent http://127.0.0.1:21324/health',
      '--health-interval', '1s', '--health-timeout', '3s', '--health-start-period', '120s', image]);
    await docker(['start', name]);
    await healthy();
    result = await check({ docker, name, image, inspect, query, healthy, readReceipt, waitFor,
      offline: () => docker(['run', '--rm', '--name', offline, '--label', label, '--network', 'none',
        '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--memory', '128m', '--cpus', '1', '--pids-limit', '32',
        '--mount', `type=volume,source=${volume},target=/app/data,readonly`,
        '--entrypoint', '/usr/libexec/postgresql18/pg_controldata', image, '/app/data/postgres']),
    });
  } catch (error) { failure = error; }
  // Labels AND exact generated names are required for deletion, including after
  // ambiguous create/run timeouts. No broad prune or installation project.
  const cleanupErrors = [];
  for (const container of [offline, name]) {
    try {
      const owned = await docker(['ps', '-aq', '--filter', `name=^/${container}$`, '--filter', `label=${label}`]);
      if (owned) await docker(['rm', '--force', container]);
    } catch (error) { cleanupErrors.push(error); }
  }
  try {
    const owned = await docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`, '--filter', `label=${label}`]);
    if (owned) { assert.equal(owned, volume); await docker(['volume', 'rm', volume]); }
  } catch (error) { cleanupErrors.push(error); }
  if (cleanupErrors.length) throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], `shutdown_drill_cleanup_failed:${name}`);
  if (failure) throw failure;
  return result;
}
