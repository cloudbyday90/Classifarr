/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { withOnlineArchiveSnapshot } from '../../ollamaGateway/onlineArchive.mjs';
import { reportSnapshot } from '../../ollamaGateway/archiveRepository.mjs';
import { captureRetentionInventory } from '../../ollamaGateway/archiveRetentionQueries.mjs';
import { verifyRestoredRetention } from '../../ollamaGateway/archiveRetentionVerification.mjs';
import { retentionInventorySha256 } from '../../ollamaGateway/archiveRetentionContract.mjs';
import { captureArchiveContent } from '../../ollamaGateway/archiveContent.mjs';
import { validateArchiveManifest } from '../../ollamaGateway/archiveContract.mjs';

let fixture, source, configuration;
beforeEach(async () => {
  fixture = await createOllamaApplicationFixture(getPool()); source = await getPool().connect();
  configuration = { providerHash: (await source.query('SELECT provider_hash FROM ollama_gateway.admission')).rows[0].provider_hash, retentionDays: 90 };
});
afterEach(async () => { source?.release(true); await fixture?.close(); });
const inspect = consume => withOnlineArchiveSnapshot(source, configuration, consume);
async function seed(count = 1, days = 100) {
  await getPool().query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT a.id,uuidv7(),a.owner_id,a.provider_hash,'synthetic',now()-make_interval(days=>$2),a.attempts+i,'unbound'
    FROM ollama_gateway.admission a CROSS JOIN generate_series(1,$1::int) i`, [count, days]);
  await getPool().query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding b
    WHERE NOT EXISTS(SELECT 1 FROM ollama_gateway.completion_receipt c WHERE c.request_id=b.request_id)`);
  await getPool().query('UPDATE ollama_gateway.admission SET attempts=attempts+$1::int,binding_count=binding_count+$1::int', [count]);
}
async function capture(reference = null) {
  return inspect(async ({ report, revision }) => {
    if (reference) report = await reportSnapshot(source, configuration.providerHash, 90, reference);
    return validateArchiveManifest({ version: 4, schemaVersion: 7, archiveId: (await source.query('SELECT uuidv7() AS id')).rows[0].id,
      report, revision, policyHash: 'a'.repeat(64), content: await captureArchiveContent(source), predecessors: [],
      retention: await captureRetentionInventory(source, report), dump: { name: 'gateway.dump', bytes: 5, sha256: 'b'.repeat(64) } });
  });
}
const verify = manifest => inspect(() => verifyRestoredRetention(source, validateArchiveManifest(manifest)));

test.each([0, 1, 101])('restored comparison verifies %i candidates without mutating source or calling provider', async count => {
  if (count) await seed(count);
  const value = await capture(), before = await inspect(() => captureArchiveContent(source));
  expect(await verify(value)).toBe(retentionInventorySha256(value.retention));
  expect(value.retention.entries).toHaveLength(Math.min(count, 100));
  expect(await inspect(() => captureArchiveContent(source))).toEqual(before); expect(fixture.calls).toHaveLength(0);
});

test('historical cutoff stays fixed even when records would now be eligible', async () => {
  await seed();
  // Historical fixture timestamps, not a claim that 20 days elapsed.
  const capturedAt = new Date(Date.now() - 20 * 86400000).toISOString();
  const cutoff = new Date(Date.parse(capturedAt) - 90 * 86400000).toISOString();
  const value = await capture({ capturedAt, cutoff });
  expect(value.retention.totalCandidates).toBe(0); expect(value.report.categories.recent).toBe(1);
  expect((await capture()).retention.totalCandidates).toBe(1);
  expect(await verify(value)).toBe(retentionInventorySha256(value.retention));
});

test('candidate totals beyond the 100-row page are recomputed, not trusted', async () => {
  await seed(101); await seed(1, 0);
  const value = await capture(); value.retention.totalCandidates = 102;
  value.report.categories.older_terminal_review = 102; value.report.categories.recent = 0;
  expect(value.retention.entries).toHaveLength(100); expect(validateArchiveManifest(value)).toBe(value);
  await expect(verify(value)).rejects.toThrow('gateway_archive_restore_mismatch');
});

test.each(['ledger', 'request', 'binding', 'row', 'attempt', 'identity', 'counter'])('rejects substituted %s evidence', async kind => {
  await seed(); const value = await capture(), entry = value.retention.entries[0];
  const otherId = (await source.query('SELECT uuidv7() AS id')).rows[0].id;
  if (kind === 'ledger') value.retention.ledgerSha256 = 'c'.repeat(64);
  if (kind === 'request') entry.requestId = otherId;
  if (kind === 'binding') entry.bindingId = otherId;
  if (kind === 'row') entry.rowSha256 = 'c'.repeat(64);
  if (kind === 'attempt') entry.attempt = '2';
  if (kind === 'identity') value.report.ledgerId = otherId;
  if (kind === 'counter') value.report.attempts = '2';
  await expect(verify(value)).rejects.toThrow('gateway_archive_restore_mismatch');
});

test('online inventory and verification keep one snapshot while real admission continues', async () => {
  await seed();
  await inspect(async ({ report }) => {
    const retention = await captureRetentionInventory(source, report);
    const claim = await fixture.ledger.claim('local'); await fixture.ledger.complete(claim, false, { state: 'response_completed', httpStatus: 200 });
    expect(await verifyRestoredRetention(source, { report, retention })).toBe(retentionInventorySha256(retention));
    expect(await captureRetentionInventory(source, report)).toEqual(retention);
  });
  expect((await capture()).report.counts.request_binding).toBe(2); expect(fixture.calls).toHaveLength(0);
});

test('new dependency evidence and admission cooldown changes cannot reuse old proof', async () => {
  await seed(); const value = await capture();
  await getPool().query(`INSERT INTO ollama_gateway.upstream_peer_observation(binding_id,public_key_sha256,certificate_sha256)
    SELECT id,repeat('a',64),repeat('b',64) FROM ollama_gateway.request_binding`);
  await expect(verify(value)).rejects.toThrow('gateway_archive_restore_mismatch');
  const withPeer = await capture();
  await getPool().query("UPDATE ollama_gateway.admission SET cooldown_until=now()+interval '1 hour'");
  await expect(verify(withPeer)).rejects.toThrow('gateway_archive_restore_mismatch');
});

test('cancellation cannot return partial candidate evidence', async () => {
  await seed(); const value = await capture();
  await expect(inspect(() => verifyRestoredRetention(source, value, AbortSignal.abort()))).rejects.toThrow();
  expect(await verify(value)).toBe(retentionInventorySha256(value.retention));
});
