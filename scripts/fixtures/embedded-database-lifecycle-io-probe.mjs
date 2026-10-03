/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Disposable tmpfs only. Never attach an existing database to this rehearsal.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, appendFileSync } from 'node:fs';
import { open, symlink, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import { createEmbeddedDatabaseStartupProcess } from '/app/src/bootstrap/embeddedDatabaseStartupProcess.mjs';
import { runEmbeddedDatabaseStartup } from '/app/src/bootstrap/embeddedDatabaseStartup.mjs';
import { createEmbeddedDatabaseControl } from '/app/src/bootstrap/embeddedDatabaseControl.mjs';
import { readEmbeddedDatabaseIdentityFile } from '/app/src/bootstrap/embeddedDatabaseIdentityFile.mjs';
import { runEmbeddedDatabaseShutdownCommand } from '/app/src/bootstrap/embeddedDatabaseShutdownCommand.mjs';
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
query("CREATE TABLE lifecycle_sentinel(value text); INSERT INTO lifecycle_sentinel VALUES ('preserved')");

// Exercise real Linux file flags without replacing the live postmaster.pid.
await writeFile('/tmp/identity-regular', '123\n/app/data/postgres\n1790000000\n');
await symlink('/tmp/identity-regular', '/tmp/identity-symlink');
execFileSync('mkfifo', ['/tmp/identity-fifo'], { timeout: 2000, shell: false });
for (const name of ['symlink', 'fifo']) {
  await assert.rejects(readEmbeddedDatabaseIdentityFile({
    openFile: (_path, flags) => open(`/tmp/identity-${name}`, flags),
  }), error => name === 'symlink' ? error.code === 'ELOOP' : error.message === 'database_identity_file_invalid');
}
process.stdout.write('PASS: real Linux symlink/FIFO identity files rejected without blocking\n');

// Simulate slow file completion. This is not a physical storage benchmark.
const events = [], processRef = new EventEmitter();
let commands = 0;
const cancelled = createEmbeddedDatabaseControl({ read: async options => {
  setTimeout(() => processRef.emit('SIGTERM'), 20);
  await sleep(150);
  return readEmbeddedDatabaseIdentityFile(options);
}, command: async () => { commands++; throw new Error('unexpected command'); } });
assert.equal(await runEmbeddedSupervisor({ database: cancelled, processRef,
  startApplication: () => { throw new Error('Application must not start'); },
  report: (state, reason) => events.push([state, reason]),
}), 1);
assert.ok(events.some(([state, reason]) => state === 'startup_failed' && reason === 'database_operation_cancelled'));
assert.equal(commands, 0);
assert.equal(query('SELECT value FROM lifecycle_sentinel'), 'preserved');
await assert.rejects(cancelled.stop(), /not_adopted/);
process.stdout.write('PASS: host cancellation joins delayed adoption; no application or database command starts\n');

let slow = false;
const delayed = createEmbeddedDatabaseControl({ read: async options => {
  if (slow) await sleep(26_500); // Return after the 25s budget and 1s join window.
  return readEmbeddedDatabaseIdentityFile(options);
}, command: async () => { commands++; throw new Error('unexpected command'); } });
await delayed.adopt();
slow = true;
const before = performance.now();
await assert.rejects(delayed.stop(), { code: 'database_operation_unjoined' });
assert.ok(performance.now() - before >= 26_000);
assert.ok(performance.now() - before < 29_000);
await sleep(600);
assert.equal(commands, 0);
await assert.rejects(delayed.stop(), /not_adopted/);
assert.equal(query('SELECT value FROM lifecycle_sentinel'), 'preserved');
process.stdout.write('PASS: stalled shutdown read expires; late completion cannot issue a stop or claim success\n');

// Stop waiting for pg_ctl while PostgreSQL itself is paused. Cancelling the
// helper does not cancel the already-sent fast-shutdown request.
const abort = new AbortController();
let helper, kinds = [];
const database = createEmbeddedDatabaseControl({ command: async (kind, options) => {
  kinds.push(kind);
  return runEmbeddedDatabaseShutdownCommand(kind, { ...options, spawnFn: (...args) => {
    helper = spawn(...args);
    setTimeout(() => abort.abort(), 300);
    return helper;
  } });
} });
await database.adopt();
const pid = Number((await readEmbeddedDatabaseIdentityFile()).split('\n')[0]);
process.kill(pid, 'SIGSTOP');
try {
  await assert.rejects(database.stop({ signal: abort.signal }), { code: 'database_operation_cancelled' });
  assert.notEqual(helper.signalCode, null);
  assert.deepEqual(kinds, ['stop']);
  await assert.rejects(database.stop(), /not_adopted/);
} finally { process.kill(pid, 'SIGCONT'); }
// PostgreSQL can complete the original request later; do not send it again.
for (let i = 0; existsSync(`${data}/postmaster.pid`) && i < 100; i++) await sleep(50);
assert.equal(existsSync(`${data}/postmaster.pid`), false);
process.stdout.write('PASS: cancelled stop helper exits; PostgreSQL completes later without a retry or false success\n');

await start();
assert.equal(query('SELECT value FROM lifecycle_sentinel'), 'preserved');
const normal = createEmbeddedDatabaseControl();
await normal.adopt(); await normal.stop();
assert.equal(existsSync(`${data}/postmaster.pid`), false);
await start();
assert.equal(query('SELECT value FROM lifecycle_sentinel'), 'preserved');
assert.equal(query('SHOW fsync'), 'on');
stop();
process.stdout.write('PASS: normal bounded shutdown confirms clean state and preserves committed data after restart\n');
