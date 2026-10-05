/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { runEmbeddedSupervisor } from '../../bootstrap/embeddedSupervisor.mjs';
import { observeEmbeddedChild } from '../../bootstrap/embeddedChildProcess.mjs';
import { createEmbeddedQueueMaintenanceBroker } from '../../bootstrap/embeddedQueueMaintenanceBroker.mjs';
import { readEmbeddedAccounts } from '../../bootstrap/embeddedIdentityPolicy.mjs';
import { asUser } from './processes.mjs';
import { assertDrillEnvironment, assertContainerLayout, childEnvironment, DATABASE, PG_DATA, STATE } from './contract.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assert.equal(process.argv.length, 2);
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
const { users } = readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8'));
const identity = users.find(user => user.name === 'postgres');
assert(identity && identity.uid !== 1000);
const pg = (program, args) => asUser('postgres', program, args, { admin: true });
const sql = async text => (await pg('psql', ['-X', '-h', '/run/postgresql', '-U', 'classifarr', '-d', DATABASE,
  '-At', '-v', 'ON_ERROR_STOP=1', '-c', text])).stdout.trim();
const status = () => pg('pg_ctl', ['-D', PG_DATA, 'status']);
const database = { adopt: status, check: status,
  stop: () => pg('pg_ctl', ['-D', PG_DATA, '-m', 'fast', '-w', '-t', '20', 'stop']) };
await sql(`SET classifarr.ingestion_protocol='1';
  REVOKE ALL ON queue_vacuum_recovery_state FROM cf_runtime;
  GRANT SELECT ON queue_vacuum_recovery_state TO cf_runtime;
  DELETE FROM queue_vacuum_recovery_state;
  INSERT INTO libraries (external_id, name, media_type) VALUES ('handoff-fixture', 'Synthetic handoff', 'movie');
  INSERT INTO media_server_items (library_id, external_id, title, media_type, enrichment_status)
  SELECT id, 'handoff-fixture', 'Synthetic handoff', 'movie', 'not_needed' FROM libraries WHERE external_id = 'handoff-fixture'`);

async function pressure() {
  await sql(`ALTER TABLE task_queue SET (autovacuum_enabled = false);
    INSERT INTO task_queue (task_type, payload, status)
      SELECT 'synthetic_handoff_pressure', '{}', 'completed' FROM generate_series(1, 15000);
    DELETE FROM task_queue WHERE task_type = 'synthetic_handoff_pressure'`);
  assert(Number(await sql("SELECT n_dead_tup FROM pg_stat_all_tables WHERE relid = 'task_queue'::regclass")) >= 10000);
}
for (const mode of ['healthy', 'eligible', 'cooldown', 'invalid']) {
  if (mode === 'eligible' || mode === 'cooldown') {
    await pressure();
    if (mode === 'eligible') await sql(`UPDATE queue_vacuum_recovery_state SET
      statistics_epoch = (SELECT c.oid::text || ':' || COALESCE(to_char(d.stats_reset AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'initial')
        FROM pg_class c, pg_stat_database d WHERE c.oid = 'task_queue'::regclass AND d.datname = current_database()),
      vacuum_progress = (SELECT vacuum_count::text || ':' || autovacuum_count::text FROM pg_stat_all_tables WHERE relid = 'task_queue'::regclass),
      pressure_since = clock_timestamp() - INTERVAL '2 hours', observed_at = clock_timestamp() - INTERVAL '15 minutes'`);
    await sql('ALTER TABLE task_queue RESET (autovacuum_enabled)');
  }
  const attemptsBefore = await sql('SELECT attempts::text FROM queue_vacuum_recovery_state');
  const events = [];
  const code = await runEmbeddedSupervisor({ database,
    startApplication: () => {
      const child = spawn('/sbin/su-exec', ['1000:1000', '/usr/local/bin/node',
        '/app/src/scripts/embeddedIsolationDrill/queueHandoffRuntimeProbe.mjs', mode], {
        cwd: '/app', shell: false, env: { ...childEnvironment(), CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' },
        stdio: ['ignore', 'inherit', 'inherit', 'pipe'],
      });
      return { ...observeEmbeddedChild(child), maintenanceChannel: child.stdio[3] };
    },
    attachRuntimeMaintenance: (application, onFatal) => createEmbeddedQueueMaintenanceBroker({
      channel: application.maintenanceChannel, identity, databaseName: DATABASE, onFatal,
      report: event => events.push(event),
    }),
  });
  assert.equal(code, 0, `supervisor mode ${mode}`);
  assert(events.includes(mode === 'invalid' ? 'request_rejected' : mode === 'eligible' ? 'completed' : 'deferred'));
  await pg('pg_ctl', ['-D', PG_DATA, '-l', `${STATE}/postgres.log`, '-w', '-t', '30', 'start']);
  if (mode === 'eligible') assert.equal(await sql('SELECT attempts::text FROM queue_vacuum_recovery_state'), '1');
  if (mode === 'cooldown' || mode === 'invalid') assert.equal(await sql('SELECT attempts::text FROM queue_vacuum_recovery_state'), attemptsBefore);
}
assert.equal(await sql('SELECT value FROM isolation_sentinel WHERE id = 1'), 'preserved');
