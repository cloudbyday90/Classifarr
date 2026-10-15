/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { runGatewayRecovery } from '../../ollamaGateway/recoveryRepository.mjs';

const sql = file => readFile(new URL(`../../../../database/ollama-gateway/${file}`,import.meta.url),'utf8');
const providerHash = 'a'.repeat(64), uuid7 = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
let clients;
async function connect() { const client = await getPool().connect(); clients.push(client); return client; }
const run = async (action = 'inspect',review,options = {}) => {
  const client = await connect();
  try { return await runGatewayRecovery(client,{ providerHash,action,review,...options }); }
  finally { clients.splice(clients.indexOf(client),1); client.release(true); }
};
const row = async () => (await getPool().query('SELECT *, started_at::text AS exact_started, cooldown_until::text AS exact_cooldown FROM ollama_gateway.admission')).rows[0];
async function review(action = 'acknowledge-stop') {
  const { expected } = await run(); await delay(2); // Observation after PostgreSQL's microsecond request timestamp.
  return { version: 1,action,expected,operatorRef: 'fixture-admin',evidenceRef: 'fixture-stop-check',observedAt: new Date().toISOString(),
    assertions: action === 'acknowledge-stop' ? { ingressIsolated: true,allProviderRunnersStopped: true,automaticRestartDisabled: true,administratorVerified: true } :
      { providerIsolationMaintained: true,controlledRestartReviewed: true,noRequestReplay: true,administratorVerified: true } };
}
async function pending(instance = null) {
  const client = await connect(), ledger = await openGatewayLedger(client,providerHash,instance);
  await ledger.claim('fixture'); await client.query('SELECT pg_advisory_unlock(11435,1)');
}
beforeEach(async () => {
  clients = [];
  await getPool().query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); // Owned disposable suite database only.
  await getPool().query(await sql('current.sql'));
});
afterEach(() => { for (const client of clients) client.release(true); });

test('fresh schema never schedules recovery and an unbound provider fails closed', async () => {
  expect((await row()).attempts).toBe(0);
  await expect(run()).rejects.toThrow('gateway_recovery_ledger_unavailable');
  expect((await getPool().query('SELECT count(*) FROM ollama_gateway.recovery_receipt')).rows[0].count).toBe(0);
});
test('offline stop, restart hold and explicit resume preserve attempts, cooldown and original precision', async () => {
  const pins = { daemonIdHash: 'a'.repeat(64),containerId: 'b'.repeat(64),imageId: `sha256:${'c'.repeat(64)}`,startedAt: '2026-10-14T09:00:00.123456789Z' };
  await pending(pins);
  const originalBinding = (await run()).requestBinding;
  await getPool().query("UPDATE ollama_gateway.admission SET cooldown_until=clock_timestamp()+interval '1 hour'");
  const before = await row(), stop = await run('acknowledge-stop',await review());
  expect(stop).toMatchObject({ state: 'maintenance',attempts: '1',replayed: false,evidenceKind: 'administrator_attested' });
  expect(stop.receiptId).toMatch(uuid7);
  const held = await row(); expect(held.completed_at).toBeNull(); expect(held.exact_cooldown).toBe(before.exact_cooldown);
  expect((await run()).requestBinding).toEqual(originalBinding);
  const receipt = (await getPool().query('SELECT *, started_at::text AS exact_started FROM ollama_gateway.recovery_receipt')).rows[0];
  expect(receipt.request_id).toBe(before.active_request); expect(receipt.exact_started).toBe(before.exact_started);
  const resumeBeforeRestart = await review('resume');
  const client = await connect(), restarted = await openGatewayLedger(client,providerHash,{ ...pins,startedAt: '2026-10-15T09:00:00Z' });
  expect(await restarted.status()).toMatchObject({ state: 'maintenance',attempts: '1',recoveryReceipt: stop.receiptId });
  await expect(restarted.claim('fixture')).rejects.toThrow('gateway_admission_deferred');
  await expect(run()).rejects.toThrow('gateway_recovery_gateway_running');
  await client.query('SELECT pg_advisory_unlock(11435,1)');
  await expect(run('resume',resumeBeforeRestart)).rejects.toThrow('gateway_recovery_state_changed');
  const resumed = await run('resume',await review('resume')); expect(resumed.receiptId).toMatch(uuid7);
  expect(resumed).toMatchObject({ state: 'resumed',attempts: '1',replayed: false });
  const after = await row(); expect(after.attempts).toBe(1); expect(after.completed_at).toBeNull();
  expect(after.maintenance_receipt).toBeNull(); expect(after.exact_cooldown).toBe(before.exact_cooldown);
  expect((await run()).latestReceipt.id).toBe(resumed.receiptId);
  expect((await run()).requestBinding).toEqual(originalBinding);
  expect(originalBinding).toMatchObject({ providerInstance: pins,evidenceKind: 'administrator_configured',recoveryAuthorized: false });
  expect(after.binding_count).toBe(1);
  const final = await openGatewayLedger(await connect(),providerHash);
  expect((await final.status()).state).toBe('cooldown'); await expect(final.claim('fixture')).rejects.toThrow();
});
test('session reentrance cannot impersonate a stopped gateway', async () => {
  const client = await connect(); await openGatewayLedger(client,providerHash);
  await expect(runGatewayRecovery(client,{ providerHash,action: 'inspect' })).rejects.toThrow('gateway_recovery_dedicated_session_required');
  await expect(run()).rejects.toThrow('gateway_recovery_gateway_running');
});
test.each(['ownerId','requestId','ledgerId','providerHash','attempts'])('refuses stale %s without clearing uncertainty', async key => {
  await pending(); const before = await row(), doc = await review();
  doc.expected[key] = key === 'attempts' ? '2' : key === 'providerHash' ? 'b'.repeat(64) :
    (await getPool().query('SELECT uuidv7() AS id')).rows[0].id;
  await expect(run('acknowledge-stop',doc)).rejects.toThrow('gateway_recovery_state_changed');
  expect((await row()).active_request).toBe(before.active_request);
});
test.each(['2000-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z'])('stale/future observation is not stop evidence: %s', async time => {
  await pending(); const doc = await review(); doc.observedAt = time;
  await expect(run('acknowledge-stop',doc)).rejects.toThrow('gateway_recovery_observation_invalid');
  expect((await row()).active_request).not.toBeNull();
});
test('stop and resume documents cannot be replayed', async () => {
  await pending(); const stop = await review(); await run('acknowledge-stop',stop);
  await expect(run('acknowledge-stop',stop)).rejects.toThrow('gateway_recovery_state_changed');
  const resume = await review('resume'); await run('resume',resume);
  await expect(run('resume',resume)).rejects.toThrow('gateway_recovery_state_changed');
  expect((await getPool().query('SELECT count(*) FROM ollama_gateway.recovery_receipt')).rows[0].count).toBe(2);
});
test.each(['insert','update','cancel','commit'])('failure at %s rolls back both receipt and marker', async boundary => {
  await pending(); const before = await row(), doc = await review(), client = await connect(), controller = new AbortController();
  const wrapped = { query: async (...args) => {
    const statement = args[0];
    if ((boundary === 'insert' && statement.startsWith('INSERT')) ||
        (boundary === 'update' && statement.startsWith('UPDATE')) || (boundary === 'commit' && statement === 'COMMIT')) throw new Error('PRIVATE');
    const result = await client.query(...args);
    if (boundary === 'cancel' && statement.startsWith('INSERT')) controller.abort();
    return result;
  } };
  await expect(runGatewayRecovery(wrapped,{ providerHash,action: 'acknowledge-stop',review: doc,signal: controller.signal }))
    .rejects.toThrow(boundary === 'cancel' ? 'gateway_recovery_cancelled' : boundary === 'commit' ? 'gateway_recovery_commit_unknown' : 'gateway_recovery_unavailable');
  expect((await row()).active_request).toBe(before.active_request);
  expect((await getPool().query('SELECT count(*) FROM ollama_gateway.recovery_receipt')).rows[0].count).toBe(0);
});
test('lost commit response is inspectable and never retried automatically', async () => {
  await pending(); const doc = await review(), client = await connect(); let commits = 0;
  const wrapped = { query: async (...args) => {
    const result = await client.query(...args);
    if (args[0] === 'COMMIT') { commits++; throw new Error('lost reply'); } return result;
  } };
  await expect(runGatewayRecovery(wrapped,{ providerHash,action: 'acknowledge-stop',review: doc })).rejects.toThrow('gateway_recovery_commit_unknown');
  expect(commits).toBe(1); const inspected = await run(); expect(inspected.expected.maintenanceReceipt).toMatch(uuid7);
  expect(inspected.expected.requestId).toBeNull(); expect(inspected.expected.attempts).toBe('1');
  await expect(run('acknowledge-stop',doc)).rejects.toThrow('gateway_recovery_state_changed');
});
test('version-1 upgrade preserves the active request; old version cannot claim after upgrade', async () => {
  const shape = async () => (await getPool().query(`SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod) AS type,
    a.attnotnull FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='ollama_gateway' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`)).rows;
  const freshShape = await shape();
  const constraints = async () => (await getPool().query(`SELECT c.relname, k.conname, pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='ollama_gateway' ORDER BY c.relname,k.conname`)).rows;
  const freshConstraints = await constraints();
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  await getPool().query(await sql('20261014_121441_admission.sql'));
  await getPool().query(`UPDATE ollama_gateway.admission SET provider_hash=$1,owner_id=uuidv7(),
    active_request=uuidv7(),installation='fixture',started_at=clock_timestamp(),attempts=3`,[providerHash]);
  const before = await row();
  await expect(openGatewayLedger(await connect(),providerHash)).rejects.toThrow('gateway_ledger_unavailable');
  // The failed startup retains its session lock until its connection is closed.
  for (const client of clients) client.release(true); clients = [];
  await getPool().query(await sql('20261014_224242_offline_recovery.sql'));
  await getPool().query(await sql('20261015_091627_request_binding.sql'));
  await getPool().query(await sql('20261015_095721_provider_stop.sql'));
  await getPool().query(await sql('20261015_104932_upstream_peer.sql'));
  await getPool().query(await sql('20261015_113726_task_source.sql'));
  await getPool().query(await sql('20261015_220007_work_history.sql'));
  expect(await shape()).toEqual(freshShape);
  expect(await constraints()).toEqual(freshConstraints);
  expect(await row()).toMatchObject({ version: 7,active_request: before.active_request,attempts: 3,owner_id: before.owner_id });
  expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=1')).rowCount).toBe(0);
  expect((await run('acknowledge-stop',await review())).state).toBe('maintenance');
});
test('schema upgrade refuses a competing session without altering version 1', async () => {
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  await getPool().query(await sql('20261014_121441_admission.sql'));
  const running = await connect(); await running.query('SELECT pg_advisory_lock(11435,1)');
  const upgrader = await connect();
  await expect(upgrader.query(await sql('20261014_224242_offline_recovery.sql'))).rejects.toThrow('gateway_must_be_stopped');
  await upgrader.query('ROLLBACK'); expect((await row()).version).toBe(1);
});
test('least-privilege runtime cannot clear holds; recovery cannot reset attempts or modify receipts', async () => {
  await pending();
  await getPool().query(`CREATE ROLE gateway_recovery_test; CREATE ROLE gateway_runtime_test;
    GRANT USAGE ON SCHEMA ollama_gateway TO gateway_recovery_test,gateway_runtime_test;
    GRANT SELECT ON ollama_gateway.admission TO gateway_recovery_test,gateway_runtime_test;
    GRANT UPDATE(active_request,installation,started_at,maintenance_receipt,last_recovery_receipt) ON ollama_gateway.admission TO gateway_recovery_test;
    GRANT SELECT,INSERT ON ollama_gateway.recovery_receipt TO gateway_recovery_test;
    GRANT SELECT ON ollama_gateway.request_binding TO gateway_recovery_test;
    GRANT SELECT ON ollama_gateway.upstream_peer_observation TO gateway_recovery_test;
    GRANT SELECT ON ollama_gateway.provider_stop_intent,ollama_gateway.provider_stop_observation TO gateway_recovery_test;
    GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt TO gateway_runtime_test;
    GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
      ON ollama_gateway.admission TO gateway_runtime_test`);
  const recovery = await connect(); await recovery.query('SET ROLE gateway_recovery_test');
  const doc = await review(); await runGatewayRecovery(recovery,{ providerHash,action: 'acknowledge-stop',review: doc });
  await expect(recovery.query('UPDATE ollama_gateway.admission SET attempts=0')).rejects.toMatchObject({ code: '42501' });
  await expect(recovery.query('DELETE FROM ollama_gateway.recovery_receipt')).rejects.toMatchObject({ code: '42501' });
  const runtime = await connect(); await runtime.query('SET ROLE gateway_runtime_test');
  await expect(runtime.query('UPDATE ollama_gateway.admission SET maintenance_receipt=NULL')).rejects.toMatchObject({ code: '42501' });
  await expect(runtime.query('INSERT INTO ollama_gateway.recovery_receipt DEFAULT VALUES')).rejects.toMatchObject({ code: '42501' });
  const ledger = await openGatewayLedger(runtime,providerHash); expect((await ledger.status()).state).toBe('maintenance');
  await expect(ledger.claim('fixture')).rejects.toThrow();
  await expect(getPool().query('DELETE FROM ollama_gateway.recovery_receipt')).rejects.toMatchObject({ code: '42501' });
  await expect(getPool().query('TRUNCATE ollama_gateway.recovery_receipt CASCADE')).rejects.toMatchObject({ code: '42501' });
});
