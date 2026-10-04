/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Only run by the disposable startup smoke harness; never on an installation.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, appendFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createEmbeddedDatabaseStartupProcess } from '/app/src/bootstrap/embeddedDatabaseStartupProcess.mjs';
import { runEmbeddedDatabaseStartup } from '/app/src/bootstrap/embeddedDatabaseStartup.mjs';

assert.equal(process.env.CLASSIFARR_STARTUP_DRILL, 'disposable-v1');
assert.equal(process.getuid(), 1000);
assert.equal(existsSync('/app/data/postgres/PG_VERSION'), false, 'Refuse a pre-existing database');
const bin = '/usr/libexec/postgresql18/';
const data = '/app/data/postgres';
const run = (name, args) => execFileSync(bin + name, args,
  { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LC_ALL: 'C' } });
run('initdb', ['-D', data, '--auth=trust', '--encoding=UTF8']);
appendFileSync(`${data}/postgresql.conf`, "\nlisten_addresses = 'localhost'\nunix_socket_directories = '/run/postgresql'\n");
const query = sql => run('psql', ['-h', '/run/postgresql', '-U', 'classifarr', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]).trim();
const stop = mode => run('pg_ctl', ['-D', data, '-m', mode, '-w', '-t', '20', 'stop']);
let owned;
async function start({ stallMs = 0, timeoutMs = 300_000, signal, events = [], injectSignal } = {}) {
  const adapter = createEmbeddedDatabaseStartupProcess();
  let resume;
  try {
    await runEmbeddedDatabaseStartup({ ...adapter, timeoutMs, signal,
      launch: () => {
        owned = adapter.launch();
        if (injectSignal) process.kill(owned.pid, injectSignal);
        if (stallMs) {
          process.kill(owned.pid, 'SIGSTOP');
          resume = setTimeout(() => { if (!owned.hasExited()) process.kill(owned.pid, 'SIGCONT'); }, stallMs);
        }
        return owned;
      }, report: event => { events.push(event); process.stdout.write(`${JSON.stringify(event)}\n`); },
    });
  } finally { clearTimeout(resume); }
}

const started = performance.now();
await start({ stallMs: 65_000 });
assert.ok(performance.now() - started >= 65_000);
query("CREATE TABLE startup_sentinel(value text); INSERT INTO startup_sentinel VALUES ('preserved')");
process.stdout.write('PASS: startup beyond sixty seconds becomes ready without relaunch\n');

const existingIdentity = readFileSync(`${data}/postmaster.pid`, 'utf8');
await assert.rejects(start(), /database_startup_.*exited/);
assert.equal(readFileSync(`${data}/postmaster.pid`, 'utf8'), existingIdentity);
assert.equal(query('SELECT value FROM startup_sentinel'), 'preserved');
process.stdout.write('PASS: another live postmaster is neither adopted nor signalled; native lock preserved\n');

stop('immediate'); // Disposable crash-recovery rehearsal; not normal shutdown policy.
await start();
assert.equal(query('SELECT value FROM startup_sentinel'), 'preserved');
assert.match(readFileSync('/app/data/postgres.log', 'utf8'), /automatic recovery in progress|database system was interrupted/);
assert.equal(query('SHOW fsync'), 'on');
stop('fast');
process.stdout.write('PASS: crash recovery preserves committed data and durability\n');

// Deterministic PID-reuse fixture. Only this fresh disposable cluster is
// modified; native lock files are NEVER rewritten by application recovery.
await readFile('/proc/self/status'); // Ensure this fixture's persistent I/O pool exists.
const worker = readdirSync('/proc/self/task').find(tid =>
  /^Name:\s+libuv-worker$/m.test(readFileSync(`/proc/self/task/${tid}/status`, 'utf8')));
assert.ok(worker, 'fixture requires a persistent libuv worker');
const staleWorkerIdentity = existingIdentity.replace(/^\d+/, worker);
writeFileSync(`${data}/postmaster.pid`, staleWorkerIdentity);
const raw = createEmbeddedDatabaseStartupProcess().launch();
try { assert.deepEqual(await raw.done, { code: 1, signal: null }); }
finally { raw.detach(); }
assert.equal(readFileSync(`${data}/postmaster.pid`, 'utf8'), staleWorkerIdentity);
const reuseEvents = [];
await start({ events: reuseEvents });
assert.ok(reuseEvents.some(event => event.status === 'parent_thread_pid_reused'));
assert.equal(query('SELECT value FROM startup_sentinel'), 'preserved');
assert.notEqual(readFileSync(`${data}/postmaster.pid`, 'utf8').split('\n')[0], worker);
stop('fast');
process.stdout.write('PASS: verified parent-worker PID reuse recovers without deleting the native lock\n');

// A foreign process is deliberately NOT exempted, even if it is harmless.
const foreign = spawn('/bin/sleep', ['30'], { stdio: 'ignore' });
const foreignExit = once(foreign, 'exit');
try {
  const foreignIdentity = existingIdentity.replace(/^\d+/, String(foreign.pid));
  writeFileSync(`${data}/postmaster.pid`, foreignIdentity);
  const events = [];
  await assert.rejects(start({ events }), /database_startup_process_exited/);
  assert.equal(readFileSync(`${data}/postmaster.pid`, 'utf8'), foreignIdentity);
  process.kill(foreign.pid, 0); // Refusal must leave the unrelated process alive.
  assert.ok(events.some(event => event.status === 'failed' && event.exitCode === 1 && event.exitSignal === null));
  assert.equal(events.some(event => event.status === 'parent_thread_pid_reused'), false);
} finally { foreign.kill('SIGTERM'); await foreignExit; }
await start(); // PostgreSQL itself now reclaims its lock after the foreign PID exits.
assert.equal(query('SELECT value FROM startup_sentinel'), 'preserved');
stop('fast');
process.stdout.write('PASS: foreign live PID is refused and its native exit code is retained\n');

const killedEvents = [];
await assert.rejects(start({ events: killedEvents, injectSignal: 'SIGKILL' }), /database_startup_process_exited/);
assert.ok(killedEvents.some(event => event.status === 'failed' && event.exitCode === null && event.exitSignal === 'SIGKILL'));
process.stdout.write('PASS: actual child signal termination remains distinct from native refusal\n');

await assert.rejects(start({ stallMs: 4000, timeoutMs: 1000 }), /timeout/);
assert.equal(owned.hasExited(), true);
await start();
assert.equal(query('SELECT value FROM startup_sentinel'), 'preserved');
stop('fast');
process.stdout.write('PASS: deadline failure stops its own postmaster and the next start preserves data\n');

const cancellation = new AbortController();
const cancel = setTimeout(() => cancellation.abort(), 1000);
try { await assert.rejects(start({ stallMs: 4000, signal: cancellation.signal }), /cancelled/); }
finally { clearTimeout(cancel); }
assert.equal(owned.hasExited(), true);
process.stdout.write('PASS: cancellation joins the launched postmaster\n');

appendFileSync(`${data}/postgresql.conf`, "\nport = 'invalid'\n");
await assert.rejects(start(), /database_startup_.*exited/);
assert.equal(owned.hasExited(), true);
process.stdout.write('PASS: invalid configuration fails before application handoff\n');

// Exercise the actual entrypoint function under Alpine sh. A tiny test helper
// isolates forwarding from PostgreSQL timing; the real child stop was tested above.
const startFunction = readFileSync('/app/docker-entrypoint.sh', 'utf8')
  .match(/^start_postgres_or_exit\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(startFunction);
writeFileSync('/tmp/startup-signal-helper.mjs', `
process.on('SIGTERM', () => { process.stdout.write('helper-stopped\\n'); process.exit(143); });
process.on('SIGINT', () => { process.stdout.write('helper-stopped\\n'); process.exit(130); });
setInterval(() => {}, 1000);
process.stdout.write('helper-ready\\n');
`);
for (const [signal, expected] of [['SIGTERM', 143], ['SIGINT', 130]]) {
  const shell = spawn('/bin/sh', ['-c', `set -eu\nIS_ROOT=false\nnode() { exec ${process.execPath} /tmp/startup-signal-helper.mjs; }\n${startFunction}\nstart_postgres_or_exit\nexit 99`],
    { env: process.env, stdio: ['ignore', 'pipe', 'inherit'] });
  const exit = once(shell, 'exit', { signal: AbortSignal.timeout(5000) });
  let output = '';
  let sent = false;
  shell.stdout.on('data', chunk => {
    output += chunk;
    if (!sent && output.includes('helper-ready')) { sent = true; shell.kill(signal); }
  });
  try {
    assert.equal((await exit)[0], expected);
    assert.match(output, /helper-stopped/);
  } finally { if (shell.exitCode === null) shell.kill('SIGKILL'); }
}
process.stdout.write('PASS: entrypoint forwards TERM and INT and waits for helper shutdown\n');
