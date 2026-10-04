/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createCustomPresetSaveService } from '../services/customPresetSaveService.mjs';
import { normalizePresetSavePayload } from '../services/customPresetSavePayload.mjs';

const id = 'efb9b919-5d23-4778-b731-888343987e71';
const pending = { id, state: 'pending', preset_id: null, resolved_at: null };
const body = { name: ' Test ', signals: {} };
const saved = { ...pending, state: 'saved', preset_id: 5, fingerprint: normalizePresetSavePayload(body).fingerprint };
function setup(...rows) {
  const query = jest.fn(async sql => sql.startsWith('SET LOCAL') ? { rows: [] } : { rows: rows.shift() ?? [] });
  const db = { withTransaction: jest.fn(fn => fn({ query })) };
  return { service: createCustomPresetSaveService({ db }), query, db };
}

test('pending lookup is bounded, actor scoped, and exposes no fingerprint', async () => {
  const { service, query } = setup([saved]);
  expect(await service.pending(7)).toEqual({ requestId: id, state: 'saved', presetId: 5, resolved: false });
  expect(query.mock.calls.slice(0, 3).map(call => call[0])).toEqual([
    "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '2s'", "SET LOCAL idle_in_transaction_session_timeout = '10s'",
  ]);
  expect(query.mock.calls[3][1]).toEqual([7]);
  expect(await setup().service.pending(7)).toBeNull();
});

test('begin prunes a bounded actor-owned batch and refuses a busy slot', async () => {
  const { service, query } = setup([], [pending]);
  expect(await service.begin(7)).toMatchObject({ requestId: id, state: 'pending' });
  expect(query.mock.calls[3]).toEqual([expect.stringContaining('LIMIT 100 FOR UPDATE SKIP LOCKED'), [7]]);
  expect(query.mock.calls[4][1]).toEqual([expect.stringMatching(/^[a-f0-9-]{36}$/), 7]);
  await expect(setup().service.begin(7)).rejects.toMatchObject({ statusCode: 409 });
});

test('complete inserts the effective payload and the server principal in one transaction', async () => {
  const { service, query, db } = setup([pending], [{ id: 5 }], [], [saved]);
  expect(await service.complete(7, id, { ...body, created_by: 99 })).toMatchObject({ state: 'saved', presetId: 5 });
  expect(db.withTransaction).toHaveBeenCalledTimes(1);
  expect(query.mock.calls.find(call => call[0].includes('INSERT INTO content_presets'))[1])
    .toEqual([5, 'custom_5_test', 'Test', null, '⚙️', 'custom', '{}', 7]);
});

test('same content is replay-safe; changed, cancelled and absent requests cannot write', async () => {
  const same = setup([saved]);
  expect(await same.service.complete(7, id, body)).toMatchObject({ presetId: 5 });
  expect(same.query).toHaveBeenCalledTimes(4);
  await expect(setup([saved]).service.complete(7, id, { name: 'Changed' })).rejects.toMatchObject({ statusCode: 409 });
  await expect(setup([{ ...pending, state: 'cancelled' }]).service.complete(7, id, body)).rejects.toMatchObject({ statusCode: 409 });
  await expect(setup().service.complete(7, id, body)).rejects.toMatchObject({ statusCode: 404 });
});

test('resolve locks the actor-owned record before making the outcome terminal', async () => {
  const { service, query } = setup([pending], [{ ...pending, state: 'cancelled', resolved_at: new Date() }]);
  expect(await service.resolve(7, id)).toEqual({ requestId: id, state: 'cancelled', presetId: null, resolved: true });
  expect(query.mock.calls[3]).toEqual([expect.stringContaining('FOR UPDATE'), [id, 7]]);
  expect(query.mock.calls[4][1]).toEqual([id]);
});
