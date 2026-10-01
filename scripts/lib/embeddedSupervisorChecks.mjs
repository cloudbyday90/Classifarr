/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

// Fixed synthetic SQL/process probes; never connected to an installation project.
const sentinel = "CREATE TABLE supervisor_sentinel(value text); INSERT INTO supervisor_sentinel VALUES ('preserved');";
const immutableImageProbe = `import assert from 'node:assert/strict';
import { open, stat } from 'node:fs/promises';
for (const path of ['/app', '/app/src', '/app/node_modules', '/app/database', '/app/scripts/lib']) {
  const info = await stat(path); assert.equal(info.uid, 0); assert.equal(info.mode & 0o022, 0);
}
for (const path of ['/app/src/index.mjs', '/app/src/bootstrap/embeddedMaintenanceChild.mjs',
  '/app/node_modules/pg/package.json', '/app/docker-entrypoint.sh', '/usr/lib/postgresql18/vector.so']) {
  const info = await stat(path); assert.equal(info.uid, 0); assert.equal(info.mode & 0o022, 0);
  await assert.rejects(async () => { const file = await open(path, 'r+'); await file.close(); },
    error => ['EACCES', 'EPERM', 'EROFS'].includes(error.code));
}`;
const signalApplication = signal => `import { readdirSync, readFileSync } from 'node:fs';
const ids = readdirSync('/proc').filter(id => /^[0-9]+$/.test(id)).filter(id => {
  try { return readFileSync('/proc/' + id + '/cmdline', 'utf8').split('\\0')[1] === '/app/src/index.mjs'; }
  catch { return false; }
});
if (ids.length !== 1) throw new Error('expected_exactly_one_application');
process.kill(Number(ids[0]), '${signal}');`;

export function checkEmbeddedSupervisor(command, report = value => process.stdout.write(`${value}\n`)) {
  const capture = (args, timeout = 30_000, expectedStatus = [0]) => command(args, timeout, { capture: true, expectedStatus });
  const query = (service, text) => capture(['exec', '-T', service, 'psql', '-X', '-U', 'classifarr', '-d', 'classifarr', '-At', '-v', 'ON_ERROR_STOP=1', '-c', text]);
  const status = service => {
    const text = capture(['ps', '--all', '--format', 'json', service]).trim();
    const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(row => JSON.parse(row));
    assert.equal(rows.length, 1);
    return rows[0];
  };
  const stopped = (service, expected) => {
    const state = status(service);
    if (state.ExitCode !== expected) {
      // Disposable synthetic configuration only; retain failure evidence before cleanup.
      report(capture(['logs', '--no-log-prefix', service]).slice(-6000));
    }
    assert.equal(state.State, 'exited');
    assert.equal(state.ExitCode, expected);
    assert.match(capture(['logs', '--no-log-prefix', service]), /"status":"database_stopped"/);
    const control = capture(['run', '--rm', '--no-deps', '--entrypoint', '/usr/libexec/postgresql18/pg_controldata', service, '/app/data/postgres']);
    assert.match(control, /Database cluster state:\s+shut down\s*\n/);
  };
  const up = service => command(['up', '--detach', '--no-build', '--wait', '--wait-timeout', '180', service], 240_000);
  for (const service of ['runtime', 'custom', 'unraid']) {
    up(service);
    const expectedUid = service === 'custom' ? '2345' : service === 'unraid' ? '99' : '1000';
    const expectedGid = service === 'unraid' ? '100' : expectedUid;
    const processes = capture(['exec', '-T', service, 'ps', '-o', 'user,args']);
    assert.match(processes, /runEmbeddedSupervisor.mjs --run/);
    const identity = capture(['exec', '-T', service, 'stat', '-c', '%u', '/app/data/postgres/postmaster.pid']);
    assert.equal(identity.trim(), expectedUid);
    command(['exec', '-T', '--user', `${expectedUid}:${expectedGid}`, service,
      'node', '--input-type=module', '-e', immutableImageProbe]);
    report(`PASS ${service}: runtime cannot overwrite image code or PostgreSQL extension binaries`);
    query(service, sentinel);
    assert.match(capture(['logs', '--no-log-prefix', service]), /"component":"EmbeddedQueueMaintenance","status":"available","authority":"shared_identity"/);
    assert.doesNotMatch(processes, /runCompatibleQueueRecovery.mjs/);
    assert.doesNotMatch(processes, /runCompatibleImageIndex.mjs/);
    command(['exec', '-T', '--user', `${expectedUid}:${expectedGid}`, '--env', 'CLASSIFARR_EMBEDDED_ISOLATION_DRILL=disposable-v1',
      service, 'node', '/app/src/scripts/embeddedIsolationDrill/compatibleImageIndexProbe.mjs'], 180_000);
    report(`PASS ${service}: compatible image worker, claim fencing and interrupted-build recovery`);
    command(['exec', '-T', '--user', `${expectedUid}:${expectedGid}`, '--env', 'CLASSIFARR_EMBEDDED_ISOLATION_DRILL=disposable-v1',
      service, 'node', '/app/src/scripts/embeddedIsolationDrill/compatibleQueueProbe.mjs'], 120_000);
    report(`PASS ${service}: on-demand compatible queue worker; no saved-template changes`);
    report(`PASS ${service}: fresh startup; database UID ${expectedUid}`);
    const stopStarted = performance.now();
    command(['stop', '--timeout', '10', service], 20_000);
    stopped(service, 0);
    report(`PASS ${service}: unchanged 10-second host timeout; stop observed in ${Math.round(performance.now() - stopStarted)} ms (includes verification)`);
    up(service);
    assert.equal(query(service, 'SELECT value FROM supervisor_sentinel').trim(), 'preserved');
    const log = capture(['exec', '-T', service, 'cat', '/app/data/postgres.log']);
    assert.doesNotMatch(log, /database system was interrupted|automatic recovery in progress/i);
    report(`PASS ${service}: clean container stop/restart; data preserved`);
    if (service === 'runtime') {
      command(['exec', '-T', service, 'node', '--input-type=module', '-e', signalApplication('SIGKILL')]);
      capture(['wait', service], 65_000, [0, 1]);
      stopped(service, 1);
      report('PASS runtime: unexpected Node exit stops database and fails container');
      up(service);
      // Do not leave the injecting exec client waiting inside a container that
      // should exit as soon as its database stops; wait from the host instead.
      command(['exec', '-T', service, '/usr/libexec/postgresql18/pg_ctl', '-D', '/app/data/postgres', '-m', 'fast', '-W', 'stop']);
      capture(['wait', service], 65_000, [0, 1]);
      stopped(service, 1);
      report('PASS runtime: database loss drains Node and fails container');
      up(service);
      // An unresponsive application cannot be promised graceful within a host
      // deadline. Exercise the real SIGKILL boundary and subsequent WAL recovery.
      command(['exec', '-T', service, 'node', '--input-type=module', '-e', signalApplication('SIGSTOP')]);
      command(['stop', '--timeout', '10', service], 20_000);
      assert.equal(status(service).ExitCode, 137);
      up(service);
      assert.equal(query(service, 'SELECT value FROM supervisor_sentinel').trim(), 'preserved');
      assert.match(capture(['exec', '-T', service, 'cat', '/app/data/postgres.log']), /database system was interrupted|automatic recovery in progress/i);
      report('PASS runtime: forced host kill is nonzero; restart recovers committed synthetic data (not a clean shutdown)');
      command(['stop', '--timeout', '10', service], 20_000);
      stopped(service, 0);
    } else {
      command(['stop', '--timeout', '10', service], 20_000);
      stopped(service, 0);
    }
  }
}
