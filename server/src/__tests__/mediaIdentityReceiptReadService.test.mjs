/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getMediaIdentityReceipt } from '../services/mediaIdentityReceiptReadService.mjs';

const previewId = '2e851bf4-9497-4b99-8b7c-e8117a05c762';
const metadata = { version: 1, reviewId: previewId, itemId: 2, tmdbId: 12, mediaType: 'movie', sourceVersion: 'a'.repeat(64) };
const db = { query: jest.fn() };
let row;
const read = () => getMediaIdentityReceipt(db, 7, 2, previewId);
beforeEach(() => {
  db.query.mockReset();
  row = { id: 8, created_at: new Date('2026-09-05T12:00:00Z'), metadata: { ...metadata, privateData: 'omit' } };
  db.query.mockImplementation(async () => ({ rows: [row] }));
});

describe('historical media identity receipt projection', () => {
  test('projects only the verified receipt and canonicalizes the reference', async () => {
    expect(await getMediaIdentityReceipt(db, '7', '2', previewId.toUpperCase())).toEqual({
      version: 1, status: 'confirmed', receipt: { auditId: 8, previewId, itemId: 2, tmdbId: 12, mediaType: 'movie', sourceVersion: metadata.sourceVersion, confirmedAt: '2026-09-05T12:00:00.000Z' },
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [7, previewId]);
  });
  test.each([
    null, [], {}, { ...metadata, version: 2 }, { ...metadata, reviewId: 'other' },
    { ...metadata, itemId: 0 }, { ...metadata, tmdbId: '12' }, { ...metadata, tmdbId: 2147483648 },
    { ...metadata, mediaType: 'person' }, { ...metadata, sourceVersion: 1 }, { ...metadata, sourceVersion: 'bad' },
  ])('fails closed for malformed metadata %j', async value => {
    row.metadata = value;
    await expect(read()).rejects.toMatchObject({ statusCode: 503, code: 'review_receipt_invalid' });
  });
  test.each([null, 'invalid date', 0])('fails closed for invalid timestamps %j', async value => {
    row.created_at = value;
    await expect(read()).rejects.toMatchObject({ statusCode: 503 });
  });
  test('accepts a serialized timestamp and rejects an invalid audit ID', async () => {
    row.created_at = '2026-09-05T12:00:00Z';
    expect((await read()).status).toBe('confirmed');
    row.id = '8';
    await expect(read()).rejects.toMatchObject({ statusCode: 503 });
  });
  test('returns no observation for absent or wrong-item evidence', async () => {
    row.metadata.itemId = 3;
    expect(await read()).toEqual({ version: 1, status: 'not_observed', receipt: null });
    row.id = null;
    expect(await read()).toEqual({ version: 1, status: 'not_observed', receipt: null });
  });
  test('rejects duplicates and a missing current administrator', async () => {
    db.query.mockResolvedValueOnce({ rows: [row, row] }).mockResolvedValueOnce({ rows: [] });
    await expect(read()).rejects.toMatchObject({ statusCode: 503 });
    await expect(read()).rejects.toMatchObject({ statusCode: 403 });
  });
  test.each([[7, 0, previewId], [0, 2, previewId], [7, 2, 'invalid'], [7, 2, `${previewId} `]])('rejects invalid lookup input before querying: %j', async (actor, item, preview) => {
    await expect(getMediaIdentityReceipt(db, actor, item, preview)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
