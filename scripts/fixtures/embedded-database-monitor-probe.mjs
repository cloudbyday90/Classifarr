/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Only the isolated tmpfs harness may run this destructive lifecycle rehearsal.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { EventEmitter, once } from 'node:events';
import { createEmbeddedDatabaseStartupProcess } from '/app/src/bootstrap/embeddedDatabaseStartupProcess.mjs';
import { runEmbeddedDatabaseStartup } from '/app/src/bootstrap/embeddedDatabaseStartup.mjs';
import { createEmbeddedDatabaseControl } from '/app/src/bootstrap/embeddedDatabaseControl.mjs';
import { runEmbeddedDatabaseStatusProbe } from '/app/src/bootstrap/embeddedDatabaseStatusProbe.mjs';
import { observeEmbeddedChild } from '/app/src/bootstrap/embeddedChildProcess.mjs';
import { runEmbeddedSupervisor } from '/app/src/bootstrap/embeddedSupervisor.mjs';

assert.equal(process.env.CLASSIFARR_STARTUP_DRILL, 'disposable-v1');
assert.equal(process.getuid(), 1000);
const data = '/app/data/postgres';
assert.equal(existsSync(`${data}/PG_VERSION`), false, 'Refuse a pre-existing database');
const run = (name, args) => execFileSync(`/usr/libexec/postgresql18/${name}`, args,
  { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LC_ALL: 'C' } });
run('initdb', ['-D', data, '--auth=trust', '--encoding=UTF8']);
appendFileSync(`${data}/postgresql.conf`, "\nlisten_addresses = 'localhost'\nunix_socket_directories = '/run/postgresql'\n");
const query = sql => run('psql', ['-h', '/run/postgresql', '-U', 'classifarr', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]).trim();
const start = () => runEmbeddedDatabaseStartup(createEmbeddedDatabaseStartupProcess());
const stop = () => run('pg_ctl', ['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']);
await start();
query("CREATE TABLE monitor_sentinel(value text); INSERT INTO monitor_sentinel VALUES ('preserved')");

let helper;
const stalledProbe = signal => runEmbeddedDatabaseStatusProbe({ signal, spawnFn: () => {
  // Fault injection replaces only the read-only status helper, not PostgreSQL.
  helper = spawn(process.execPath, ['--input-type=module', '-e', 'setInterval(() => {}, 1000)'], { shell: false, stdio: 'ignore' });
  return helper;
} });

async function supervise({ status, onReport, delay } = {}) {
  const processRef = new EventEmitter();
  const events = [];
  let started = 0;
  // Adoption now uses the same bounded read-only helper. Inject faults only
  // after adoption so these cases continue to exercise runtime monitoring.
  const database = createEmbeddedDatabaseControl({ status: options =>
    started && status ? status(options) : runEmbeddedDatabaseStatusProbe(options) });
  // A real small application child exercises drain ordering without the full
  // product's migrations, providers or background work in this lifecycle test.
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000); process.stdout.write('ready');"],
  { shell: false, stdio: ['ignore', 'pipe', 'inherit'] });
  const application = observeEmbeddedChild(child);
  await once(child.stdout, 'data', { signal: AbortSignal.timeout(5000) });
  const result = await runEmbeddedSupervisor({ database, processRef, delay,
    startApplication: () => { started++; return application; },
    report: (state, reason) => {
      events.push([state, reason]);
      onReport?.({ state, reason, processRef, child });
    },
  });
  assert.equal(started, 1);
  assert.equal(application.hasExited(), true);
  assert.equal(processRef.eventNames().length, 0);
  return { result, events };
}

let checks = 0;
const identity = readFileSync(`${data}/postmaster.pid`, 'utf8');
const recovered = await supervise({
  status: ({ signal }) => ++checks === 1 ? stalledProbe(signal) : runEmbeddedDatabaseStatusProbe({ signal }),
  onReport: ({ state, child, processRef }) => {
    if (state !== 'database_probe_recovered') return;
    assert.equal(helper.signalCode, 'SIGKILL');
    assert.equal(child.exitCode, null);
    assert.equal(readFileSync(`${data}/postmaster.pid`, 'utf8'), identity);
    assert.equal(query('SELECT value FROM monitor_sentinel'), 'preserved');
    processRef.emit('SIGTERM');
  },
});
assert.equal(recovered.result, 0);
assert.equal(checks, 2);
assert.ok(recovered.events.some(([state]) => state === 'database_probe_waiting'));
assert.ok(recovered.events.some(([state]) => state === 'database_stopped'));
process.stdout.write('PASS: real timed-out helper exits; recovery keeps application and database identity unchanged\n');

await start();
let waitingAt;
const expired = await supervise({ status: ({ signal }) => stalledProbe(signal),
  onReport: ({ state, reason }) => {
    if (state === 'database_probe_waiting') waitingAt = performance.now();
    if (state === 'stopping') {
      assert.equal(reason, 'database_probe_grace_expired');
      assert.ok(performance.now() - waitingAt >= 15_000);
      assert.ok(performance.now() - waitingAt < 20_000);
    }
  },
});
assert.equal(expired.result, 1);
assert.equal(expired.events.filter(([state]) => state === 'database_probe_waiting').length, 1);
assert.ok(expired.events.some(([state]) => state === 'database_stopped'));
process.stdout.write('PASS: repeated helper timeouts exhaust one fixed grace window and drain once\n');

await start();
const dead = await supervise({ onReport: ({ state }) => { if (state === 'supervising') stop(); } });
assert.equal(dead.result, 1);
assert.ok(dead.events.some(([state, reason]) => state === 'stopping' && reason === 'database_unavailable'));
assert.equal(dead.events.some(([state]) => state === 'database_probe_waiting'), false);
process.stdout.write('PASS: actual stopped PostgreSQL fails without a transient grace window\n');

await start();
let cancelTimer;
const cancelled = await supervise({
  status: ({ signal }) => stalledProbe(signal),
  delay: async () => {},
  onReport: ({ state, processRef }) => {
    if (state === 'supervising') cancelTimer = setTimeout(() => processRef.emit('SIGTERM'), 250);
    if (state === 'database_stopped') assert.notEqual(helper.signalCode, null);
  },
});
clearTimeout(cancelTimer);
assert.equal(cancelled.result, 0);
assert.equal(cancelled.events.some(([state]) => state === 'database_probe_waiting'), false);
await start();
assert.equal(query('SELECT value FROM monitor_sentinel'), 'preserved');
assert.equal(query('SHOW fsync'), 'on');
stop();
process.stdout.write('PASS: host cancellation joins the helper before database stop; committed data survives every restart\n');
