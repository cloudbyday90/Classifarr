/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { createCachedAdjudicationWriter, readCachedAdjudication, PRUNE_ADJUDICATION_SQL } from '../../services/cachedAdjudicationRepository.mjs';

let client, save;
const configuration = 'a'.repeat(64);
const batch = () => ({ version: 'cached_adjudication.v1', configuration,
  identity: { model: 'test:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [{ key: 'c'.repeat(64),
    generated: { response: 'PRIVATE model response', latencyMs: 1, promptTokens: 10, outputTokens: 10,
      outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } }] });
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('CREATE TEMP TABLE cached_adjudication_batch(LIKE public.cached_adjudication_batch INCLUDING ALL)');
  save = createCachedAdjudicationWriter({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
});
afterEach(() => { client?.release(true); });

test('atomic replacement, exact configuration, expiry and automatic physical cleanup', async () => {
  await save(batch());
  expect(await readCachedAdjudication(client, configuration)).toEqual(batch());
  expect(await readCachedAdjudication(client, 'd'.repeat(64))).toBeNull();
  const firstRetention = (await client.query('SELECT captured_at,expires_at FROM cached_adjudication_batch')).rows[0];
  const next = batch(); next.records[0].generated.response = 'new private response'; await save(next);
  expect((await client.query('SELECT captured_at,expires_at FROM cached_adjudication_batch')).rows[0]).toEqual(firstRetention);
  expect((await client.query('SELECT count(*)::int AS total FROM cached_adjudication_batch')).rows[0].total).toBe(1);
  const invalid = batch(); invalid.records.push(invalid.records[0]);
  await expect(save(invalid)).rejects.toThrow('invalid');
  expect(await readCachedAdjudication(client, configuration)).toEqual(next);
  await client.query("UPDATE cached_adjudication_batch SET captured_at=now()-interval '8 days',expires_at=now()-interval '1 day'");
  expect(await readCachedAdjudication(client, configuration)).toBeNull();
  expect((await client.query(PRUNE_ADJUDICATION_SQL)).rowCount).toBe(1);
});

test('future and malformed batches cannot be consumed; rollback keeps previous batch', async () => {
  await save(batch());
  const controller = new AbortController(); controller.abort();
  await expect(save(batch(), controller.signal)).rejects.toThrow();
  expect(await readCachedAdjudication(client, configuration)).toEqual(batch());
  await client.query("UPDATE cached_adjudication_batch SET captured_at=now()+interval '1 day',expires_at=now()+interval '2 days'");
  expect(await readCachedAdjudication(client, configuration)).toBeNull();
  expect((await client.query(PRUNE_ADJUDICATION_SQL)).rowCount).toBe(1);
  await client.query("INSERT INTO cached_adjudication_batch VALUES(true,'{}',now(),now()+interval '1 day')");
  expect(await readCachedAdjudication(client, configuration)).toBeNull();
});

test('schema enforces size and retention, and migration is idempotent', async () => {
  await expect(client.query("INSERT INTO cached_adjudication_batch VALUES(true,'{}',now(),now()+interval '8 days')")).rejects.toMatchObject({ code: '23514' });
  await expect(client.query("INSERT INTO cached_adjudication_batch VALUES(true,$1,now(),now()+interval '1 day')", [JSON.stringify({ text: 'x'.repeat(1048576) })]))
    .rejects.toMatchObject({ code: '23514' });
  const sql = await readFile(new URL('../../../../database/migrations/20260925_110000_add_cached_adjudication_batch.sql', import.meta.url), 'utf8');
  await client.query(sql); await client.query(sql);
});
