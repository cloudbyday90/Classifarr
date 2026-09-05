/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { getMediaIdentityReceipt } from '../../services/mediaIdentityReceiptReadService.mjs';

const db = createIntegrationDatabaseModuleMock();
let actors, metadata;
beforeEach(async () => {
  actors = (await db.query(`INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'admin'), ($2, 'test', 'admin') RETURNING id`, [randomUUID(), randomUUID()])).rows.map(row => row.id);
  metadata = { version: 1, reviewId: randomUUID(), itemId: 123, tmdbId: 12, mediaType: 'tv', sourceVersion: 'a'.repeat(64) };
});
afterEach(async () => {
  await db.query('DELETE FROM audit_log WHERE user_id = ANY($1::int[])', [actors]);
  await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [actors]);
});
const read = (actor = actors[0], client = db) => getMediaIdentityReceipt(client, actor, metadata.itemId, metadata.reviewId);
const insert = (client = db) => client.query("INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, 'media_identity_confirmed', $2) RETURNING id", [actors[0], metadata]);

describe('committed media identity receipt recovery in PostgreSQL', () => {
  test('remains available without source or preview rows, using a read-only transaction', async () => {
    const { rows } = await insert();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN READ ONLY');
      const first = await read(actors[0], client);
      expect(first).toMatchObject({ status: 'confirmed', receipt: { auditId: rows[0].id, itemId: 123, tmdbId: 12, mediaType: 'tv' } });
      expect(await read(actors[0], client)).toEqual(first);
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect((await db.query('SELECT count(*)::int AS count FROM audit_log WHERE user_id = $1', [actors[0]])).rows[0].count).toBe(1);
  });
  test('does not mistake an in-flight confirmation for a failed write', async () => {
    const writer = await getPool().connect();
    try {
      await writer.query('BEGIN');
      await insert(writer);
      expect(await read()).toEqual({ version: 1, status: 'not_observed', receipt: null });
      await writer.query('COMMIT');
      expect((await read()).status).toBe('confirmed');
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
    }
  });
  test('isolates other actors and sources and rejects revoked administrators', async () => {
    await insert();
    expect(await read(actors[1])).toEqual({ version: 1, status: 'not_observed', receipt: null });
    expect((await getMediaIdentityReceipt(db, actors[0], 124, metadata.reviewId)).status).toBe('not_observed');
    await db.query("UPDATE users SET role = 'user' WHERE id = $1", [actors[0]]);
    await expect(read()).rejects.toMatchObject({ statusCode: 403 });
    await db.query("UPDATE users SET role = 'admin', is_active = false WHERE id = $1", [actors[0]]);
    await expect(read()).rejects.toMatchObject({ statusCode: 403 });
  });
  test('fails closed if an audit reference has duplicate evidence', async () => {
    await insert();
    await insert();
    await expect(read()).rejects.toMatchObject({ statusCode: 503, code: 'review_receipt_invalid' });
  });
  test('uses the partial expression index in a 10,001-receipt audit history', async () => {
    await db.query(`INSERT INTO audit_log (user_id, action, metadata)
      SELECT $1, 'media_identity_confirmed', jsonb_build_object('reviewId', gen_random_uuid()::text)
      FROM generate_series(1, 10000)`, [actors[0]]);
    await insert();
    await db.query('ANALYZE audit_log');
    // Explain the exact service statement against realistic cardinality, without forcing the planner.
    let plan;
    const explain = { query: async (sql, params) => {
      plan = (await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`, params)).rows; // sql-interpolation: sql is the service's static SELECT, never request input.
      return db.query(sql, params);
    } };
    expect((await read(actors[0], explain)).status).toBe('confirmed');
    expect(JSON.stringify(plan)).toContain('idx_audit_log_media_identity_receipt');
  });
});
