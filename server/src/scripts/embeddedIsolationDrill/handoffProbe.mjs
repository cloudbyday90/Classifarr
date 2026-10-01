/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { runEmbeddedSupervisor } from '../../bootstrap/embeddedSupervisor.mjs';
import { startEmbeddedMaintenance } from '../../bootstrap/embeddedMaintenanceChild.mjs';
import { readEmbeddedAccounts } from '../../bootstrap/embeddedIdentityPolicy.mjs';
import { encryptBackupPayload } from '../../services/backupCipher.mjs';
import { assertDrillEnvironment, assertContainerLayout, DATABASE, PG_DATA, STATE } from './contract.mjs';
import { asUser, startRuntime, waitForRuntime } from './processes.mjs';

// Only the collision-checked, network-isolated scratch cluster can reach this probe.
assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assert.equal(process.argv.length, 2);
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
const { users } = readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8'));
const identity = users.find(user => user.name === 'postgres');
assert(identity && identity.uid !== 1000);
const pg = (program, args) => asUser('postgres', program, args, { admin: true });
const status = () => pg('pg_ctl', ['-D', PG_DATA, 'status']);
const database = { adopt: status, check: status,
  stop: () => pg('pg_ctl', ['-D', PG_DATA, '-m', 'fast', '-w', '-t', '20', 'stop']) };

for (const kind of ['schema', 'restore', 'indexes', 'vacuum']) {
  if (kind === 'indexes') {
    await pg('psql', ['-X', '-h', '/run/postgresql', '-U', 'classifarr', '-d', DATABASE,
      '-v', 'ON_ERROR_STOP=1', '-c', "INSERT INTO task_queue (task_type, payload) VALUES ('rebuild_hnsw_index', '{}')"]);
  }
  const password = randomBytes(32).toString('hex');
  const request = kind === 'restore' ? Buffer.from(JSON.stringify({ version: 1, mode: 'merge', password,
    backup: { encrypted: true, data: encryptBackupPayload({ version: '2.0', data: {
      settings: [{ key: 'supervisor_handoff_probe', value: 'preserved' }],
    } }, password) } })) : null;
  const events = [];
  let validation;
  const result = await runEmbeddedSupervisor({ database,
    startMaintenance: () => startEmbeddedMaintenance({ kind, identity, databaseName: DATABASE, request }),
    startApplication: () => {
      assert(events.includes('maintenance_completed'));
      const runtime = startRuntime();
      validation = (async () => {
        try {
          await waitForRuntime(runtime);
          assert.equal((await fetch('http://127.0.0.1:21324/api/libraries', { signal: AbortSignal.timeout(2000) })).status, 401);
        } finally { runtime.child.kill('SIGTERM'); }
      })();
      validation.catch(() => { /* joined below after supervisor teardown */ });
      return { done: runtime.done, signal: signal => runtime.child.kill(signal) };
    }, report: event => events.push(event),
  });
  request?.fill(0);
  await validation;
  assert.equal(result, 0);
  assert(events.includes('application_stopped') && events.includes('database_stopped'));
  assert.match((await pg('pg_controldata', [PG_DATA])).stdout, /Database cluster state:\s+shut down\s*\n/);
  await pg('pg_ctl', ['-D', PG_DATA, '-l', `${STATE}/postgres.log`, '-w', '-t', '30', 'start']);
  if (kind === 'indexes') {
    const completed = await pg('psql', ['-X', '-h', '/run/postgresql', '-U', 'classifarr', '-d', DATABASE, '-At',
      '-v', 'ON_ERROR_STOP=1', '-c', "SELECT count(*) FROM task_queue WHERE task_type = 'rebuild_hnsw_index' AND status = 'completed'"]);
    assert.equal(completed.stdout.trim(), '1');
  }
}
const result = await pg('psql', ['-X', '-h', '/run/postgresql', '-U', 'classifarr', '-d', DATABASE, '-At',
  '-v', 'ON_ERROR_STOP=1', '-c', "SELECT value FROM settings WHERE key = 'supervisor_handoff_probe'"]);
assert.equal(result.stdout.trim(), 'preserved');
