/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { withGatewayArchiveSnapshot } from '../../ollamaGateway/archiveRepository.mjs';
import { captureRetentionInventory } from '../../ollamaGateway/archiveRetentionQueries.mjs';
import { compareGatewayRetention } from '../../ollamaGateway/archiveReviewService.mjs';
import { ARCHIVE_TABLES } from '../../ollamaGateway/archiveContract.mjs';

let fixture, configuration;
const state = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
beforeEach(async () => {
  fixture = await createOllamaApplicationFixture(getPool());
  configuration = { providerHash: (await state()).provider_hash, retentionDays: 90 };
});
afterEach(async () => { await fixture?.close(); });
const stop = async () => { await fixture.close(); fixture = null; };
async function session(action) {
  const client = await getPool().connect();
  try { return await action(client); } finally { client.release(true); }
}
const capture = () => session(client => withGatewayArchiveSnapshot(client, configuration, async ({ report, archiveId }) => ({
  version: 2, schemaVersion: 7, archiveId, report, dump: { name: 'gateway.dump', bytes: 5, sha256: 'a'.repeat(64) },
  retention: await captureRetentionInventory(client, report),
})));
// SQL comparison unit of the workflow. File verification is exercised by the packaged Linux rehearsal.
const review = (manifest, overrides = {}, signal) => session(client => compareGatewayRetention(client,
  { ...configuration, ...overrides }, manifest, 'b'.repeat(64), signal));
async function seed({ outcome = 'response_completed', admissionDays = 100, completionDays = 100, attempt = 1 } = {}) {
  const binding = (await getPool().query(`INSERT INTO ollama_gateway.request_binding
    (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,uuidv7(),owner_id,provider_hash,'synthetic',now()-make_interval(days=>$1),$2,'unbound'
    FROM ollama_gateway.admission RETURNING *`, [admissionDays, attempt])).rows[0];
  if (outcome) await getPool().query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    VALUES($1,$2,$3,now()-make_interval(days=>$4))`, [binding.request_id, outcome,
    outcome === 'response_completed' ? 200 : outcome === 'provider_rejected' ? 429 : null, completionDays]);
  await getPool().query('UPDATE ollama_gateway.admission SET binding_count=binding_count+1,attempts=$1', [attempt]);
  return binding;
}
const addRecovery = b => getPool().query(`INSERT INTO ollama_gateway.recovery_receipt
  (ledger_id,action,provider_hash,owner_id,request_id,installation,started_at,attempts,operator_ref,evidence_ref,observed_at)
  VALUES($1,'acknowledge-stop',$2,$3,$4,'synthetic',$5,$6,'synthetic','retention-test',now())`,
[b.ledger_id, b.provider_hash, b.owner_id, b.request_id, b.admitted_at, b.attempt]);
const addPeer = b => getPool().query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
  VALUES($1,repeat('a',64),repeat('b',64))`, [b.id]);

test('gateway ownership prevents review and no provider work is attempted', async () => {
  await expect(capture()).rejects.toThrow('gateway_archive_gateway_running'); expect(fixture.calls).toHaveLength(0);
});

test('empty review has native UUIDv7 and no permission to purge', async () => {
  await stop(); const before = await state(), manifest = await capture(), result = await review(manifest);
  expect(result).toMatchObject({ status: 'no_work', entries: [], reasons: [], remainingCandidates: 0, purgeAuthorized: false, restoreVerified: false });
  expect(result.reviewId).toMatch(/^[a-f0-9-]{14}7/); expect(result.reviewId).not.toBe(manifest.archiveId);
  expect(await state()).toEqual(before);
});

test.each(['response_completed', 'provider_rejected', 'not_dispatched'])('terminal candidate %s matches without mutating any table', async outcome => {
  await stop(); const binding = await seed({ outcome }); await addPeer(binding);
  const rows = async () => Promise.all(ARCHIVE_TABLES.map(name => getPool().query(`SELECT * FROM ollama_gateway.${name} ORDER BY id`).then(r => r.rows)));
  const before = await rows(), manifest = await capture(), result = await review(manifest);
  expect(result.status).toBe('ready_for_review'); expect(result.entries).toEqual([{ ...manifest.retention.entries[0], status: 'matched' }]);
  expect(result.entries[0].bindingId).toBe(binding.id); expect(result.purgeAuthorized).toBe(false);
  expect(await rows()).toEqual(before);
});

test.each([{ outcome: null }, { outcome: 'completion_observed' }, { admissionDays: 0 }, { completionDays: 0 }])('unknown or recent rows are excluded %j', async options => {
  await stop(); await seed(options); const manifest = await capture();
  expect(manifest.retention.entries).toEqual([]); expect((await review(manifest)).status).toBe('no_work');
});

test('active, recovery and provider-stop references are never candidates', async () => {
  await stop(); const active = await seed(), recovered = await seed({ attempt: 2 }), stopped = await seed({ attempt: 3 });
  await addRecovery(recovered);
  await getPool().query(`INSERT INTO ollama_gateway.provider_stop_intent(binding_id,owner_id,attempts,network_id,configuration_hash,
    network_hash,operator_ref,evidence_ref,reviewed_at) VALUES($1,$2,3,repeat('a',64),repeat('b',64),repeat('c',64),'test','test',now())`, [stopped.id, stopped.owner_id]);
  await getPool().query("UPDATE ollama_gateway.admission SET active_request=$1,installation='synthetic',started_at=now()", [active.request_id]);
  const manifest = await capture(); expect(manifest.retention.entries).toEqual([]);
  expect(manifest.report.categories).toMatchObject({ active: 1, lifecycle: 2 });
});

test('new recovery protection blocks the entire previously matched plan', async () => {
  await stop(); const binding = await seed(), manifest = await capture(); await addRecovery(binding);
  const result = await review(manifest); expect(result.status).toBe('blocked');
  expect(result.reasons).toEqual(expect.arrayContaining(['history_changed', 'entries_changed']));
  expect(result.entries[0].status).toBe('protected');
});

test('new TLS evidence changes row digest and blocks review', async () => {
  await stop(); const binding = await seed(), manifest = await capture(); await addPeer(binding);
  const result = await review(manifest); expect(result.status).toBe('blocked'); expect(result.entries[0].status).toBe('changed');
});

test('inventory and report share a snapshot even if another administrator appends evidence', async () => {
  await stop(); const binding = await seed();
  const manifest = await session(client => withGatewayArchiveSnapshot(client, configuration, async ({ report, archiveId }) => {
    await addPeer(binding);
    return { version: 2, schemaVersion: 7, archiveId, report,
      dump: { name: 'gateway.dump', bytes: 5, sha256: 'a'.repeat(64) }, retention: await captureRetentionInventory(client, report) };
  }));
  expect(manifest.report.counts.upstream_peer_observation).toBe(0);
  expect((await review(manifest)).entries[0].status).toBe('changed');
});

test('review retains the archived cutoff and exact candidate set', async () => {
  await stop(); await seed(); const manifest = await capture();
  const result = await review(manifest);
  expect(result.cutoff).toBe(manifest.report.cutoff);
  expect(result.entries.map(entry => entry.bindingId)).toEqual(manifest.retention.entries.map(entry => entry.bindingId));
});

test('admission drift blocks even when the candidate itself is unchanged', async () => {
  await stop(); await seed(); const manifest = await capture();
  await getPool().query("UPDATE ollama_gateway.admission SET cooldown_until=now()+interval '1 hour'");
  const before = await state(), result = await review(manifest);
  expect(result.status).toBe('blocked'); expect(result.reasons).toContain('ledger_changed'); expect(await state()).toEqual(before);
});

test('source, retention and counter mismatches block; wrong provider is refused', async () => {
  await stop(); await seed(); const manifest = await capture();
  expect((await review(manifest, { retentionDays: 91 })).reasons).toContain('retention_changed');
  await expect(review(manifest, { providerHash: 'f'.repeat(64) })).rejects.toThrow('gateway_archive_ledger_unavailable');
  const wrong = structuredClone(manifest); wrong.report.ledgerId = (await getPool().query('SELECT uuidv7() AS id')).rows[0].id;
  expect((await review(wrong)).reasons).toContain('source_mismatch');
  await getPool().query('UPDATE ollama_gateway.admission SET binding_count=0');
  expect((await review(manifest)).reasons).toContain('inconsistent_history');
});

test('legacy missing binding blocks review and v1 archives cannot invent an inventory', async () => {
  await stop(); await getPool().query("UPDATE ollama_gateway.admission SET active_request=uuidv7(),installation='legacy',started_at=now(),attempts=1");
  const manifest = await capture(); expect((await review(manifest)).reasons).toContain('inconsistent_history');
  const { retention: _retention, ...legacy } = manifest;
  await expect(review({ ...legacy, version: 1 })).rejects.toThrow('gateway_archive_review_requires_inventory');
});

test('unknown binding references and altered row hashes never match', async () => {
  await stop(); await seed(); const manifest = await capture(), wrong = structuredClone(manifest);
  wrong.retention.entries[0].rowSha256 = 'c'.repeat(64);
  expect((await review(wrong)).entries[0].status).toBe('changed');
  wrong.retention.entries[0].bindingId = (await getPool().query('SELECT uuidv7() AS id')).rows[0].id;
  expect((await review(wrong)).entries[0].status).toBe('missing');
});

test('at most 100 oldest attempts are inventoried; remaining candidates stay explicit', async () => {
  await stop(); for (let attempt = 1; attempt <= 101; attempt++) await seed({ attempt });
  const manifest = await capture(); expect(manifest.retention.entries).toHaveLength(100);
  expect(manifest.retention.entries[99].attempt).toBe('100'); expect(manifest.retention.hasMore).toBe(true);
  const result = await review(manifest); expect(result.remainingCandidates).toBe(1); expect(result.entries).toHaveLength(100);
});

test('cancellation preserves state and allows a later explicit read', async () => {
  await stop(); await seed(); const manifest = await capture(), before = await state(), controller = new AbortController(); controller.abort();
  await expect(review(manifest, {}, controller.signal)).rejects.toThrow('gateway_archive_cancelled');
  expect(await state()).toEqual(before); expect((await review(manifest)).status).toBe('ready_for_review');
});

test('SELECT-only role can review with stable UTC hashing independent of session timezone', async () => {
  await stop(); await seed(); const manifest = await capture();
  await getPool().query(`CREATE ROLE gateway_retention_reader; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_retention_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_retention_reader`);
  await session(async client => {
    await client.query("SET ROLE gateway_retention_reader; SET timezone='Pacific/Auckland'; SET datestyle='SQL, DMY'");
    const result = await compareGatewayRetention(client, configuration, manifest, 'b'.repeat(64));
    expect(result.status).toBe('ready_for_review');
    await expect(client.query('DELETE FROM ollama_gateway.request_binding')).rejects.toMatchObject({ code: '42501' });
  });
});
