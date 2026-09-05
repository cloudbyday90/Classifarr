/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createMediaIdentityReviewService } from '../../services/mediaIdentityReviewService.mjs';

const db = createIntegrationDatabaseModuleMock();
let actors, item, service, details;
const resolution = { tmdb_resolution: { version: 1, status: 'review_required', reason: 'conflicting_external_ids' }, retained: 'source metadata' };

beforeEach(async () => {
  actors = (await db.query(`INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'admin'), ($2, 'test', 'admin') RETURNING id`, [randomUUID(), randomUUID()])).rows.map(row => row.id);
  item = (await db.query(`INSERT INTO media_server_items (external_id, title, year, media_type, metadata)
    VALUES ($1, 'Review fixture', 2026, 'movie', $2) RETURNING id`, [randomUUID(), resolution])).rows[0].id;
  details = jest.fn().mockResolvedValue({ id: 12, title: 'Verified movie', release_date: '2026-01-01' });
  service = createMediaIdentityReviewService({ db, getIdentityDetails: details });
});
afterEach(async () => {
  await db.query('DELETE FROM audit_log WHERE user_id = ANY($1::int[])', [actors]);
  await db.query('DELETE FROM media_server_items WHERE id = $1', [item]);
  await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [actors]);
});
async function prepare(actor = actors[0]) {
  const source = (await service.list(actor)).items.find(row => row.id === item);
  return service.preview(actor, item, { tmdbId: 12, sourceVersion: source.sourceVersion });
}
function confirm(preview, actor = actors[0]) {
  return service.confirm(actor, item, { previewId: preview.previewId, confirmed: true });
}
async function stored() {
  return (await db.query('SELECT tmdb_id, metadata FROM media_server_items WHERE id = $1', [item])).rows[0];
}

describe('identity review PostgreSQL transactions', () => {
  test('commits one typed ID and audit receipt without classification writes', async () => {
    const historyBefore = (await db.query('SELECT count(*) AS count FROM classification_history')).rows[0].count;
    const preview = await prepare();
    expect((await stored()).tmdb_id).toBeNull();
    const receipt = await confirm(preview);
    const recovered = await service.getReceipt(actors[0], item, preview.previewId);
    expect(recovered).toMatchObject({ status: 'confirmed', receipt: { auditId: receipt.auditId, itemId: item, tmdbId: 12, mediaType: 'movie' } });
    expect(details).toHaveBeenCalledTimes(1);
    const row = await stored();
    expect(row.tmdb_id).toBe(12);
    expect(row.metadata.retained).toBe('source metadata');
    expect(row.metadata.tmdb_resolution).toMatchObject({ status: 'resolved', method: 'operator', review_id: preview.previewId });
    const audit = (await db.query('SELECT * FROM audit_log WHERE id = $1', [receipt.auditId])).rows[0];
    expect(audit).toMatchObject({ user_id: actors[0], action: 'media_identity_confirmed' });
    expect(audit.metadata).toEqual({ version: 1, reviewId: preview.previewId, itemId: item, tmdbId: 12, mediaType: 'movie', sourceVersion: preview.source.sourceVersion, previousReason: 'conflicting_external_ids' });
    expect((await db.query('SELECT count(*) AS count FROM classification_history')).rows[0].count).toBe(historyBefore);
    expect((await service.list(actors[0])).items).toEqual([]);
    await expect(confirm(preview)).rejects.toMatchObject({ statusCode: 409 });
  });
  test('bounds and filters inventory and rejects unsupported filters', async () => {
    expect((await service.list(actors[0], { mediaType: 'tv' })).items).toEqual([]);
    expect((await service.list(actors[0], { afterId: String(item) })).items).toEqual([]);
    for (const query of [{ limit: 51 }, { mediaType: 'person' }, { afterId: '-1' }, { unexpected: 'x' }]) {
      await expect(service.list(actors[0], query)).rejects.toMatchObject({ statusCode: 400 });
    }
  });
  test('recovers the historical identity after the source changes and is deleted', async () => {
    const preview = await prepare();
    await confirm(preview);
    await db.query('UPDATE media_server_items SET tmdb_id = 999 WHERE id = $1', [item]);
    const recovered = await service.getReceipt(actors[0], item, preview.previewId);
    expect(recovered).toMatchObject({ status: 'confirmed', receipt: { tmdbId: 12 } });
    await db.query('DELETE FROM media_server_items WHERE id = $1', [item]);
    expect(await service.getReceipt(actors[0], item, preview.previewId)).toEqual(recovered);
    expect(details).toHaveBeenCalledTimes(1);
  });
  test('uses the TV namespace even when the numeric movie ID also exists', async () => {
    await db.query("UPDATE media_server_items SET media_type = 'tv' WHERE id = $1", [item]);
    details.mockResolvedValue({ id: 12, name: 'Verified TV series', first_air_date: '2026-01-01' });
    const preview = await prepare();
    expect(details).toHaveBeenCalledWith(12, 'tv');
    expect(preview.candidate.mediaType).toBe('tv');
    expect((await confirm(preview)).candidate.title).toBe('Verified TV series');
  });
  test('returns a keyset cursor without skipping the next item', async () => {
    const second = (await db.query(`INSERT INTO media_server_items (external_id, title, media_type, metadata)
      VALUES ($1, 'Second fixture', 'movie', $2) RETURNING id`, [randomUUID(), resolution])).rows[0].id;
    try {
      const firstPage = await service.list(actors[0], { limit: 1 });
      expect(firstPage.items.map(row => row.id)).toEqual([item]);
      expect(firstPage.nextCursor).toBe(item);
      const secondPage = await service.list(actors[0], { limit: 1, afterId: firstPage.nextCursor });
      expect(secondPage.items.map(row => row.id)).toEqual([second]);
      expect(secondPage.nextCursor).toBeNull();
    } finally {
      await db.query('DELETE FROM media_server_items WHERE id = $1', [second]);
    }
  });
  test('refuses a role revoked while the provider request was in flight', async () => {
    details.mockImplementation(async () => {
      await db.query("UPDATE users SET role = 'user' WHERE id = $1", [actors[0]]);
      return { id: 12, title: 'Verified movie' };
    });
    await expect(prepare()).rejects.toMatchObject({ statusCode: 403 });
    expect((await db.query('SELECT * FROM media_identity_review_previews WHERE actor_id = $1', [actors[0]])).rows).toEqual([]);
  });
  test('rejects body tampering and unconfirmed writes', async () => {
    const preview = await prepare();
    for (const body of [{ previewId: preview.previewId, confirmed: false }, { previewId: preview.previewId, confirmed: true, tmdbId: 999 }, { previewId: 'invalid', confirmed: true }]) {
      await expect(service.confirm(actors[0], item, body)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect((await stored()).tmdb_id).toBeNull();
  });
  test('binds the preview to its actor and source item', async () => {
    const preview = await prepare();
    await expect(confirm(preview, actors[1])).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.confirm(actors[0], item + 1, { previewId: preview.previewId, confirmed: true })).rejects.toMatchObject({ statusCode: 409 });
    await expect(confirm(preview)).resolves.toHaveProperty('auditId');
  });
  test('replaces prior previews and refuses expired previews', async () => {
    const old = await prepare();
    const current = await prepare();
    await expect(confirm(old)).rejects.toMatchObject({ statusCode: 409 });
    expect((await db.query('SELECT count(*) AS count FROM media_identity_review_previews WHERE actor_id = $1', [actors[0]])).rows[0].count).toBe(1);
    await db.query("UPDATE media_identity_review_previews SET expires_at = clock_timestamp() - interval '1 second' WHERE actor_id = $1", [actors[0]]);
    await expect(confirm(current)).rejects.toMatchObject({ code: 'review_preview_expired' });
    expect((await stored()).tmdb_id).toBeNull();
  });
  test.each(['title', 'media_type', 'tmdb_id'])('refuses a changed source field: %s', async field => {
    const preview = await prepare();
    const statements = {
      title: "UPDATE media_server_items SET title = 'Changed' WHERE id = $1",
      media_type: "UPDATE media_server_items SET media_type = 'tv' WHERE id = $1",
      tmdb_id: 'UPDATE media_server_items SET tmdb_id = 999 WHERE id = $1',
    };
    await db.query(statements[field], [item]);
    await expect(confirm(preview)).rejects.toMatchObject({ code: 'review_source_changed' });
  });
  test('detects an edit and reversal through the PostgreSQL row revision', async () => {
    const preview = await prepare();
    await db.query("UPDATE media_server_items SET title = 'Changed' WHERE id = $1", [item]);
    await db.query("UPDATE media_server_items SET title = 'Review fixture' WHERE id = $1", [item]);
    await expect(confirm(preview)).rejects.toMatchObject({ code: 'review_source_changed' });
  });
  test('rechecks source after provider I/O without keeping a transaction open', async () => {
    details.mockImplementation(async () => {
      await db.query("UPDATE media_server_items SET title = 'Changed during lookup' WHERE id = $1", [item]);
      return { id: 12, title: 'Verified movie' };
    });
    await expect(prepare()).rejects.toMatchObject({ code: 'review_source_changed' });
    expect((await db.query('SELECT * FROM media_identity_review_previews WHERE actor_id = $1', [actors[0]])).rows).toEqual([]);
  });
  test.each(["role = 'user'", 'is_active = false'])('rechecks current account authorization: %s', async change => {
    const preview = await prepare();
    await db.query(`UPDATE users SET ${change} WHERE id = $1`, [actors[0]]);
    await expect(confirm(preview)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.list(actors[0])).rejects.toMatchObject({ statusCode: 403 });
    expect((await stored()).tmdb_id).toBeNull();
  });
  test('only one of two administrators can confirm the same source', async () => {
    const previews = await Promise.all(actors.map(actor => prepare(actor)));
    const results = await Promise.allSettled(previews.map((preview, index) => confirm(preview, actors[index])));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')[0].reason.statusCode).toBe(409);
    expect((await db.query('SELECT * FROM audit_log WHERE user_id = ANY($1::int[])', [actors])).rows).toHaveLength(1);
  });
  test('audit failure rolls back the identity and preview consumption', async () => {
    const preview = await prepare();
    await db.query("ALTER TABLE audit_log ADD CONSTRAINT identity_review_test_failure CHECK (action <> 'media_identity_confirmed')");
    try {
      await expect(confirm(preview)).rejects.toThrow('identity_review_test_failure');
      expect((await stored()).tmdb_id).toBeNull();
      expect((await service.getReceipt(actors[0], item, preview.previewId)).status).toBe('not_observed');
      expect((await db.query('SELECT * FROM media_identity_review_previews WHERE id = $1', [preview.previewId])).rows).toHaveLength(1);
    } finally {
      await db.query('ALTER TABLE audit_log DROP CONSTRAINT identity_review_test_failure');
    }
    await expect(confirm(preview)).resolves.toHaveProperty('auditId');
  });
  test.each([404, 429, 500])('provider failure %s cannot create a preview', async status => {
    details.mockRejectedValue({ response: { status }, message: 'private provider response' });
    await expect(prepare()).rejects.toMatchObject({ statusCode: status === 404 ? 404 : 503 });
    expect((await stored()).tmdb_id).toBeNull();
    expect((await db.query('SELECT * FROM media_identity_review_previews WHERE actor_id = $1', [actors[0]])).rows).toEqual([]);
  });
});
