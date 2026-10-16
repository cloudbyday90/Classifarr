/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { readGatewayRetentionAssessment } from '../../ollamaGateway/retentionAssessmentRepository.mjs';
import { createGatewayRetentionMonitor } from '../../ollamaGateway/retentionMonitor.mjs';
import { createGatewayServer } from '../../ollamaGateway/server.mjs';
import { gatewayConfig } from '../../ollamaGateway/contract.mjs';
import { withGatewayArchiveSnapshot } from '../../ollamaGateway/archiveRepository.mjs';

let fixture;
const state = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
const read = days => fixture.ledger.assessRetention((sql, args) => getPool().query(sql, args), days);
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool()); });
afterEach(async () => { await fixture?.close(); });
async function seed(count = 1, outcome = 'response_completed', days = 100) {
  await getPool().query(`INSERT INTO ollama_gateway.request_binding
    (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,uuidv7(),owner_id,provider_hash,'synthetic',statement_timestamp()-make_interval(days=>$2),attempts+n,'unbound'
    FROM ollama_gateway.admission CROSS JOIN generate_series(1,$1::int) n`, [count, days]);
  if (outcome) await getPool().query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT b.request_id,$1,$2,b.admitted_at FROM ollama_gateway.request_binding b
    WHERE NOT EXISTS(SELECT 1 FROM ollama_gateway.completion_receipt c WHERE c.request_id=b.request_id)`,
  [outcome, outcome === 'response_completed' ? 200 : outcome === 'provider_rejected' ? 429 : null]);
  await getPool().query('UPDATE ollama_gateway.admission SET attempts=attempts+$1,binding_count=binding_count+$1', [count]);
}

test('empty assessment has native time-based reference and no provider or database mutation', async () => {
  const before = await state(), report = await read(90);
  expect(report).toMatchObject({ capacity: 'normal', decision: 'not_needed', candidates: 0, bindingCount: 0, purgeAuthorized: false });
  expect((await getPool().query('SELECT uuid_extract_version($1::uuid) AS version', [report.reference])).rows[0].version).toBe(7);
  expect(await state()).toEqual(before); expect(fixture.calls).toHaveLength(0);
});
test.each(['response_completed', 'provider_rejected', 'not_dispatched'])('old terminal outcome %s is a candidate, not deletion authority', async outcome => {
  await seed(1, outcome); const before = await state();
  expect(await read(90)).toMatchObject({ decision: 'not_needed', candidates: 1, protectedCount: 0 });
  expect(await state()).toEqual(before); expect(fixture.calls).toHaveLength(0);
});
test.each([null, 'completion_observed'])('unknown outcome %s remains protected', async outcome => {
  await seed(1, outcome); expect(await read(90)).toMatchObject({ candidates: 0, protectedCount: 1, categories: { unknown: 1 } });
});
test('admission or completion within the horizon is protected', async () => {
  await seed(1, 'response_completed', 0);
  expect((await read(90)).categories.recent).toBe(1);
  expect((await read(1)).candidates).toBe(0);
});
test('active, recovery and provider-stop references agree with offline archive classification', async () => {
  await seed(3); const bindings = (await getPool().query('SELECT * FROM ollama_gateway.request_binding ORDER BY attempt')).rows;
  await getPool().query("UPDATE ollama_gateway.admission SET active_request=$1,installation='synthetic',started_at=now(),cooldown_until=now()+interval '1 hour'", [bindings[0].request_id]);
  await getPool().query(`INSERT INTO ollama_gateway.recovery_receipt
    (ledger_id,action,provider_hash,owner_id,request_id,installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
    SELECT ledger_id,'acknowledge-stop',provider_hash,owner_id,request_id,installation,admitted_at,attempt,'test','test',now()
    FROM ollama_gateway.request_binding WHERE id=$1`, [bindings[1].id]);
  await getPool().query(`INSERT INTO ollama_gateway.provider_stop_intent(binding_id,owner_id,attempts,network_id,configuration_hash,
    network_hash,operator_ref,evidence_ref,reviewed_at) VALUES($1,$2,3,repeat('a',64),repeat('b',64),repeat('c',64),'test','test',now())`,
  [bindings[2].id, bindings[2].owner_id]);
  const before = await state(), assessment = await read(90);
  expect(assessment).toMatchObject({ candidates: 0, categories: { active: 1, lifecycle: 2 } });
  expect(await state()).toEqual(before);
  await fixture.close(); fixture = null;
  const client = await getPool().connect();
  try {
    const archived = await withGatewayArchiveSnapshot(client, { providerHash: before.provider_hash, retentionDays: 90 });
    expect(assessment.categories).toEqual(archived.categories);
  } finally { client.release(true); }
});
test('legacy missing binding and counter drift block cleanup conclusions', async () => {
  await getPool().query("UPDATE ollama_gateway.admission SET active_request=uuidv7(),installation='legacy',started_at=now(),attempts=1");
  expect((await read(90)).decision).toBe('assessment_blocked');
  await getPool().query('UPDATE ollama_gateway.admission SET active_request=NULL,installation=NULL,started_at=NULL,binding_count=100000');
  expect(await read(90)).toMatchObject({ capacity: 'full', decision: 'assessment_blocked', projectedCount: null });
});
test('real 100,000-row capacity reports pressure and headroom without resetting attempts', async () => {
  await seed(100000); const before = await state(), client = await getPool().connect();
  try {
    await client.query("SET statement_timeout='4s'");
    const report = await fixture.ledger.assessRetention((sql, args) => client.query(sql, args), 90);
    expect(report).toMatchObject({ capacity: 'full', decision: 'cleanup_needed', candidates: 100000, projectedCount: 0, sufficientHeadroom: true });
    expect(await state()).toEqual(before); expect(fixture.calls).toHaveLength(0);
  } finally { client.release(true); }
});
test('owner/provider fencing refuses stale assessment, not a zero-count report', async () => {
  const before = await state();
  for (const binding of [{ owner: '0199ea26-7d80-7000-8000-000000000001', providerHash: before.provider_hash },
    { owner: before.owner_id, providerHash: 'f'.repeat(64) }]) {
    await expect(readGatewayRetentionAssessment((sql, args) => getPool().query(sql, args), binding)).rejects.toThrow('gateway_retention_unavailable');
  }
  expect(await state()).toEqual(before);
});
test('SELECT-only column grants suffice; missing evidence permission fails without harming admission writer', async () => {
  await getPool().query(`CREATE ROLE gateway_assessment_reader; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_assessment_reader;
    GRANT SELECT ON ollama_gateway.admission,ollama_gateway.request_binding,ollama_gateway.completion_receipt TO gateway_assessment_reader;
    GRANT SELECT(request_id) ON ollama_gateway.recovery_receipt TO gateway_assessment_reader`);
  const client = await getPool().connect();
  try {
    await client.query('SET ROLE gateway_assessment_reader');
    await expect(fixture.ledger.assessRetention((sql, args) => client.query(sql, args), 90)).rejects.toMatchObject({ code: '42501' });
    expect((await fixture.ledger.status()).state).toBe('ready');
    await getPool().query('GRANT SELECT(binding_id) ON ollama_gateway.provider_stop_intent TO gateway_assessment_reader');
    await client.query('BEGIN READ ONLY');
    expect((await fixture.ledger.assessRetention((sql, args) => client.query(sql, args), 90)).decision).toBe('not_needed');
    await client.query('COMMIT');
    await expect(client.query('SELECT operator_ref FROM ollama_gateway.provider_stop_intent')).rejects.toMatchObject({ code: '42501' });
    await expect(client.query('DELETE FROM ollama_gateway.request_binding')).rejects.toMatchObject({ code: '42501' });
  } finally { client.release(true); }
});
test('automatic check precedes HTTP access; authenticated status uses cache, not provider or diagnostic queries', async () => {
  let reads = 0;
  const monitor = createGatewayRetentionMonitor({ read: () => { reads++; return read(90); } });
  const config = gatewayConfig({ upstream: 'http://127.0.0.1:11434', models: ['synthetic:latest'],
    credentials: [{ installation: 'local', workClass: 'foreground', token: 'x'.repeat(43) }] });
  const gateway = createGatewayServer({ config, ledger: fixture.ledger, retention: monitor });
  try {
    const end = Date.now() + 4000;
    while (monitor.status().state === 'pending') { if (Date.now() > end) throw new Error('assessment_timeout'); await delay(10); }
    expect(reads).toBe(1); expect(monitor.status().state).toBe('available');
    await new Promise(resolve => { gateway.server.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${gateway.server.address().port}/gateway/status`;
    expect((await fetch(url)).status).toBe(401);
    for (let n = 0; n < 5; n++) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${'x'.repeat(43)}` } });
      expect(response.status).toBe(200); const body = await response.json();
      expect(body.retention).toMatchObject({ state: 'available', assessment: { decision: 'not_needed' } });
      expect(JSON.stringify(body.retention)).not.toMatch(/synthetic|owner_id|provider_hash|request_id/);
    }
    expect(reads).toBe(1); expect(fixture.calls).toHaveLength(0);
  } finally { await gateway.stop(); }
});
test('standalone entrypoint owns a separate bounded read-only pool and stops its monitor', async () => {
  const script = await readFile(new URL('../../scripts/runOllamaGateway.mjs', import.meta.url), 'utf8');
  expect(script).toContain('max: 1'); expect(script).toContain('default_transaction_read_only=on');
  expect(script).toContain('retention?.stop()'); expect(script).toContain('diagnostics?.end()');
});
