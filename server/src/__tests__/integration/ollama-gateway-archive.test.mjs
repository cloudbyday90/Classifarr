/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { withGatewayArchiveSnapshot } from '../../ollamaGateway/archiveRepository.mjs';

let fixture, providerHash;
const state = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool()); providerHash = (await state()).provider_hash; });
afterEach(async () => { await fixture?.close(); });
const stop = async () => { await fixture.close(); fixture = null; };
async function inspect(options = {}, consume) {
  const client = await getPool().connect();
  try { return await withGatewayArchiveSnapshot(client, { providerHash, retentionDays: 90, ...options }, consume); }
  finally { client.release(true); }
}

test('running gateway is refused without modifying any state or calling the provider', async () => {
  const before = await state(); await expect(inspect()).rejects.toThrow('gateway_archive_gateway_running');
  expect(await state()).toEqual(before); expect(fixture.calls).toHaveLength(0);
});
test('empty offline snapshot is read-only, repeatable and has native UUIDv7 archive identity', async () => {
  await stop(); const before = await state();
  const report = await inspect({}, async value => {
    expect(value.archiveId).toMatch(/^[a-f0-9-]{14}7/); expect(value.snapshot).toMatch(/^[A-F0-9-]+$/);
    return value.report;
  });
  expect(report.counts.request_binding).toBe(0); expect(report.purgeAuthorized).toBe(false);
  expect(report.counterMatches).toBe(true); expect(await state()).toEqual(before);
});
test('same session lock cannot be reused as offline authority', async () => {
  await stop(); const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock(11435,1)');
    await expect(withGatewayArchiveSnapshot(client, { providerHash, retentionDays: 90 })).rejects.toThrow('gateway_archive_dedicated_session_required');
  } finally { client.release(true); }
});
test.each(['f'.repeat(64), ''])('wrong or absent provider cannot archive', async hash => {
  await stop(); await expect(inspect({ providerHash: hash })).rejects.toThrow();
});

test('an uninitialized provider is refused without initializing the ledger', async () => {
  await stop(); await getPool().query('UPDATE ollama_gateway.admission SET provider_hash=NULL');
  const before = await state();
  await expect(inspect()).rejects.toThrow('gateway_archive_ledger_unavailable'); expect(await state()).toEqual(before);
});

test('missing schema objects fail closed rather than reporting an empty archive', async () => {
  await stop(); await getPool().query('ALTER TABLE ollama_gateway.admission RENAME TO incomplete_admission');
  await expect(inspect()).rejects.toThrow('gateway_archive_unavailable');
});
test('cancellation rolls back the snapshot and releases ownership without resetting attempts', async () => {
  await fixture.ledger.claim('local'); await stop(); const before = await state(), controller = new AbortController();
  await expect(inspect({ signal: controller.signal }, async () => { controller.abort(); })).rejects.toThrow('gateway_archive_cancelled');
  expect(await state()).toEqual(before); expect((await inspect()).categories.active).toBe(1);
});
test('legacy active request without a binding is visible and never inferred complete', async () => {
  await stop(); await getPool().query("UPDATE ollama_gateway.admission SET active_request=uuidv7(),installation='legacy',started_at=now(),attempts=1");
  const result = await inspect(); expect(result.legacyActiveWithoutBinding).toBe(true);
  expect(result.categories.older_terminal_review).toBe(0); expect(result.attempts).toBe('1');
});
test('observed completion without a known outcome stays unknown and active work stays protected', async () => {
  const complete = await fixture.ledger.claim('local'); await fixture.ledger.complete(complete);
  await fixture.ledger.claim('local'); await stop(); const before = await state();
  const result = await inspect(); expect(result.categories).toEqual({ active: 1, lifecycle: 0, unknown: 1, recent: 0, older_terminal_review: 0 });
  expect(await state()).toEqual(before);
});
test('read-only restricted role can inspect and callback writes fail with no partial mutation', async () => {
  await stop(); const pool = getPool(), client = await pool.connect(), before = await state();
  await pool.query(`CREATE ROLE gateway_archive_reader; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_archive_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_archive_reader`);
  try {
    await client.query('SET ROLE gateway_archive_reader');
    const report = await withGatewayArchiveSnapshot(client, { providerHash, retentionDays: 90 }, async value => {
      expect((await client.query("SELECT current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0])
        .toEqual({ ro: 'on', isolation: 'repeatable read' });
      return value.report;
    }); expect(report.counts.admission).toBe(1);
    await client.query('RESET ROLE');
    await expect(withGatewayArchiveSnapshot(client, { providerHash, retentionDays: 90 }, async () => {
      await expect(client.query('UPDATE ollama_gateway.admission SET attempts=1')).rejects.toMatchObject({ code: '25006' });
      throw new Error('private injected error');
    })).rejects.toThrow('gateway_archive_unavailable');
  } finally { client.release(true); }
  expect(await state()).toEqual(before); await expect(inspect()).resolves.toHaveProperty('purgeAuthorized', false);
});
test('classification prioritizes lifecycle evidence and considers both admission and completion dates', async () => {
  await stop(); const pool = getPool();
  for (const [index, outcome, oldCompletion] of [[0, 'response_completed', true], [1, 'provider_rejected', false], [2, 'not_dispatched', true], [3, null, true]]) {
    const b = (await pool.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
      SELECT id,uuidv7(),owner_id,provider_hash,'local',now()-interval '100 days',$1,'unbound' FROM ollama_gateway.admission RETURNING id,request_id`, [index + 1])).rows[0];
    if (outcome) await pool.query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
      VALUES($1,$2,$3,now()-make_interval(days=>$4))`, [b.request_id, outcome, outcome === 'response_completed' ? 200 : outcome === 'provider_rejected' ? 404 : null, oldCompletion ? 100 : 0]);
    if (index === 2) await pool.query(`INSERT INTO ollama_gateway.recovery_receipt(ledger_id,action,provider_hash,owner_id,request_id,installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
      SELECT id,'acknowledge-stop',provider_hash,owner_id,$1,'local',now()-interval '100 days',3,'synthetic','synthetic',now() FROM ollama_gateway.admission`, [b.request_id]);
  }
  await pool.query('UPDATE ollama_gateway.admission SET attempts=4,binding_count=4');
  const report = await inspect(); expect(report.categories).toEqual({ active: 0, lifecycle: 1, unknown: 1, recent: 1, older_terminal_review: 1 });
  await pool.query('UPDATE ollama_gateway.admission SET binding_count=3');
  expect((await inspect()).counterMatches).toBe(false); expect((await state()).binding_count).toBe(3);
});
