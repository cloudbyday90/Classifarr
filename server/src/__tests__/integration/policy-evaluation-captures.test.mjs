/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { holdPolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';
import { persistPolicyEvaluationCapture, prunePolicyEvaluationCaptures } from '../../services/policyEvaluationCaptureRepository.mjs';
import { readPolicyEvaluationContext, READ_POLICY_EVALUATION_INPUT_SQL } from '../../services/policyEvaluationCaptureRead.mjs';
import { policyEvaluationPayloadBytes } from '../../services/policyEvaluationCaptureContract.mjs';
import { mintPolicyEvaluationFixture } from '../fixtures/policyEvaluationCaptureFixture.mjs';
import { readBackupConfiguration } from '../../services/backupExportCatalog.mjs';
import { clearExistingConfig } from '../../services/backupRestore.mjs';

async function storedFixture({ exactId = false, old = false, unwritten = false } = {}) {
  const database = getPool();
  const library = (await database.query("INSERT INTO libraries(name,external_id,media_type) VALUES('PRIVATE LIBRARY '||$1,$1,'movie') RETURNING id", [randomUUID()])).rows[0];
  const fixture = mintPolicyEvaluationFixture(undefined, { libraryId: library.id });
  const row = (await database.query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,library_id)
    VALUES(COALESCE($1::bigint,nextval('classification_history_id_seq')),'PRIVATE CAPTURE TITLE',42,'movie','completed','ai_analysis',$2) RETURNING *`,
  [exactId ? '9223372036854775807' : null, library.id])).rows[0];
  if (!old && !unwritten) {
    const held = holdPolicyEvaluationCapture(fixture.result, fixture.item);
    expect(await persistPolicyEvaluationCapture(database, { classificationId: row.id, held, result: fixture.result, metadata: fixture.item })).toBe(true);
  } else if (old) {
    const payload = structuredClone(fixture.capture.payload);
    const observed = (await database.query("SELECT NOW() - INTERVAL '31 days' AS observed")).rows[0].observed;
    payload.capturedAt = observed.toISOString();
    await database.query(`INSERT INTO classification_policy_evaluation_captures
      (classification_id,media_type,identity_key,observed_at,expires_at,reason_id,payload)
      VALUES($1,'movie','movie:42',$2,$2::timestamptz+INTERVAL '720 hours','complete',$3)`, [row.id, observed, payload]);
  }
  return { database, fixture, row, id: String(row.id) };
}
const readRow = async (database, id) => (await database.query('SELECT * FROM classification_policy_evaluation_captures WHERE classification_id=$1', [id])).rows[0];

test('exact BIGINT first write wins; direct replacement, early expiry, deletion and truncation are rejected', async () => {
  const { database, fixture, row, id } = await storedFixture({ exactId: true });
  const held = holdPolicyEvaluationCapture(fixture.result, fixture.item), before = await readRow(database, id);
  expect(await persistPolicyEvaluationCapture(database, { classificationId: id, held, result: fixture.result, metadata: fixture.item })).toBe(false);
  expect((await readRow(database, id))).toEqual(before);
  await expect(database.query("UPDATE classification_policy_evaluation_captures SET reason_id='capture_invalid',payload=NULL WHERE classification_id=$1", [id])).rejects.toThrow('only permit');
  await expect(database.query('UPDATE classification_policy_evaluation_captures SET payload=NULL,expired_at=NOW() WHERE classification_id=$1', [id])).rejects.toThrow('only permit');
  await expect(database.query('DELETE FROM classification_policy_evaluation_captures WHERE classification_id=$1', [id])).rejects.toThrow('only with');
  await expect(database.query('TRUNCATE classification_policy_evaluation_captures')).rejects.toThrow('cannot be truncated');
  expect(String(row.id)).toBe('9223372036854775807');
});

test('database binding refuses different typed identity and preserves the valid classification', async () => {
  const { database, fixture, id } = await storedFixture();
  const wrong = mintPolicyEvaluationFixture({ media_type: 'tv', tmdb_id: 42 }), held = holdPolicyEvaluationCapture(wrong.result, wrong.item);
  expect(await persistPolicyEvaluationCapture(database, { classificationId: id, held, result: wrong.result, metadata: wrong.item })).toBe(false);
  expect((await readRow(database, id)).payload).toEqual(fixture.capture.payload);
});

test('expiry clears payload once, preserves the immutable tombstone and prohibits rehydration', async () => {
  const { database, fixture, id } = await storedFixture({ old: true });
  expect(await prunePolicyEvaluationCaptures(database)).toBe(1);
  const tombstone = await readRow(database, id);
  expect(tombstone.payload).toBeNull(); expect(tombstone.expired_at).toBeInstanceOf(Date);
  expect(await prunePolicyEvaluationCaptures(database)).toBe(0);
  await expect(database.query('UPDATE classification_policy_evaluation_captures SET payload=$1,expired_at=NULL WHERE classification_id=$2', [fixture.capture.payload, id])).rejects.toThrow('only permit');
  const held = holdPolicyEvaluationCapture(fixture.result, fixture.item);
  expect(await persistPolicyEvaluationCapture(database, { classificationId: id, held, result: fixture.result, metadata: fixture.item })).toBe(false);
  expect(await readRow(database, id)).toEqual(tombstone);
});

test('concurrent expiry skips locked evidence and a later pass completes it', async () => {
  const { database, id } = await storedFixture({ old: true }), owner = await database.connect();
  try {
    await owner.query('BEGIN'); await owner.query('SELECT 1 FROM classification_policy_evaluation_captures WHERE classification_id=$1 FOR UPDATE', [id]);
    expect(await prunePolicyEvaluationCaptures(database)).toBe(0);
    await owner.query('COMMIT'); expect(await prunePolicyEvaluationCaptures(database)).toBe(1);
  } finally { await owner.query('ROLLBACK'); owner.release(); }
});

test('History deletion cascades its capture; configuration restore retains surviving historical evidence outside export', async () => {
  const { database, id } = await storedFixture(), before = await readRow(database, id);
  const exported = await readBackupConfiguration(database);
  expect(JSON.stringify(exported)).not.toContain('policy_evaluation.v1');
  const client = await database.connect();
  try {
    await client.query('BEGIN'); await clearExistingConfig(client);
    expect(await readRow(client, id)).toEqual(before);
  } finally { await client.query('ROLLBACK'); client.release(); }
  await database.query('DELETE FROM classification_history WHERE id=$1', [id]);
  expect(await readRow(database, id)).toBeUndefined();
});

test('database-side sidecar admission includes policy payloads before transfer and reader validates exact historical binding', async () => {
  const { database, fixture, row, id } = await storedFixture();
  const shadow = { version: 'diagnostic_sql_fixture' };
  await database.query("UPDATE classification_history SET metadata=jsonb_build_object('classification_details',jsonb_build_object('inventory_ranking_shadow',$1::jsonb)) WHERE id=$2", [shadow, id]);
  const bounds = [new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() + 86400000).toISOString()];
  const admitted = (await database.query(READ_POLICY_EVALUATION_INPUT_SQL, [...bounds, 67108864])).rows;
  const input = admitted.find(entry => entry.input?.classification_id === id).input;
  expect(input.policy_evaluation.payload).toEqual(fixture.capture.payload);
  expect(readPolicyEvaluationContext({ ...input, recorded_at: row.recorded_at }, Date.now()).status).toBe('available');
  const denied = (await database.query(READ_POLICY_EVALUATION_INPUT_SQL, [...bounds, 1])).rows;
  expect(denied).toHaveLength(1); expect(denied[0].input).toBeNull(); expect(Number(denied[0].payload_bytes)).toBeGreaterThan(1000);
});

test('expired payloads are withheld in SQL before physical cleanup while the tombstone remains readable', async () => {
  const { database, row, id } = await storedFixture({ old: true });
  await database.query('UPDATE classification_history SET metadata=$1 WHERE id=$2',
    [{ classification_details: { inventory_ranking_shadow: {} } }, id]);
  const bounds = [new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() + 1000).toISOString()];
  const source = (await database.query(READ_POLICY_EVALUATION_INPUT_SQL, [...bounds, 67108864])).rows.find(entry => entry.input?.classification_id === id).input;
  expect(source.policy_evaluation.payload).toBeNull(); expect((await readRow(database, id)).payload).not.toBeNull();
  expect(readPolicyEvaluationContext({ ...source, recorded_at: row.recorded_at }, Date.now())).toEqual({ status: 'unavailable', reason: 'expired' });
});

test('PostgreSQL rejects oversized child payloads and agrees with jsonb byte admission', async () => {
  const { database, fixture, id } = await storedFixture({ unwritten: true });
  await expect(database.query(`INSERT INTO classification_policy_evaluation_captures
    (classification_id,media_type,identity_key,observed_at,expires_at,reason_id,payload)
    VALUES($1,'movie','movie:42',$2,$2::timestamptz+INTERVAL '720 hours','complete',$3)`,
  [id, fixture.capture.capturedAt, { padding: 'x'.repeat(65536) }])).rejects.toMatchObject({ code: '23514' });
  expect(await readRow(database, id)).toBeUndefined();
  for (const value of [fixture.capture.payload, { x: 1e-300, y: -1.23e-30, z: [1e-7, 1000000] }]) {
    const measured = (await database.query('SELECT octet_length($1::jsonb::text) AS bytes', [JSON.stringify(value)])).rows[0].bytes;
    expect(policyEvaluationPayloadBytes(value)).toBe(measured);
  }
});
