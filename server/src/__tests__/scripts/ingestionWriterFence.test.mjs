/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { assertFenceRehearsalDatabase, fenceRole } from '../../scripts/ingestionWriterFence/contract.mjs';
import { prepareFenceRehearsal, cutOverFenceRehearsal } from '../../scripts/ingestionWriterFence/install.mjs';
import { createFenceRehearsalClient } from '../../scripts/ingestionWriterFence/client.mjs';

afterEach(() => jest.restoreAllMocks());
test.each(['production', 'development', undefined])('ordinary %s environment refuses before even querying', async env => {
  jest.replaceProperty(process, 'env', { NODE_ENV: env });
  const db = { query: jest.fn() };
  await expect(assertFenceRehearsalDatabase(db)).rejects.toThrow('disposable');
  await expect(prepareFenceRehearsal(db)).rejects.toThrow('disposable');
  await expect(cutOverFenceRehearsal(db, {})).rejects.toThrow('disposable');
  expect(db.query).not.toHaveBeenCalled();
});
test.each(['classifarr', 'classifarr_suite_', 'classifarr_suite_abcdefabcdef_extra', null])('rejects database %s', async database => {
  jest.replaceProperty(process, 'env', { NODE_ENV: 'test', CLASSIFARR_INTEGRATION_RUN_ID: 'isolated' });
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ database }] }) };
  await expect(prepareFenceRehearsal(db)).rejects.toThrow('database_rejected');
  expect(db.query).toHaveBeenCalledTimes(1);
});
test.each(['postgres', 'cf_fence_owner_123', 'cf_fence_owner_abcdefabcdef;DROP ROLE x', '', null])('rejects role %s', value => {
  expect(() => fenceRole(value)).toThrow('role_rejected');
});
test.each(['owner', 'writer', 'legacy'])('accepts only generated %s identity', kind => {
  expect(fenceRole(`cf_fence_${kind}_123456abcdef`)).toBe(`cf_fence_${kind}_123456abcdef`);
});
test('client construction stays idle; invalid library never sends SQL', async () => {
  const client = { query: jest.fn() }, api = createFenceRehearsalClient(client);
  expect(client.query).not.toHaveBeenCalled();
  await expect(api.begin(0)).rejects.toThrow('Invalid');
  expect(client.query).not.toHaveBeenCalled();
});
test('busy owner defers without calling a write gateway', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }) };
  const api = createFenceRehearsalClient(client);
  expect(await api.begin(5)).toMatchObject({ deferred: true, reason: 'ingestion_owned' });
  expect(await api.begin(5)).toMatchObject({ deferred: true });
  expect(client.query).toHaveBeenCalledTimes(2);
});
test('failed claim unlocks and permits retry; active scope cannot stack locks', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  client.query.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockRejectedValueOnce(new Error('source_not_ready'));
  const api = createFenceRehearsalClient(client);
  await expect(api.begin(5)).rejects.toThrow('source_not_ready');
  expect(client.query.mock.calls[2][0]).toContain('pg_advisory_unlock');
  client.query.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValueOnce({ rows: [{ token: 'synthetic' }] });
  const run = await api.begin(5);
  await expect(api.begin(5)).rejects.toThrow('already_active');
  await api.write(run, "x'); DROP TABLE nope; --", 'Synthetic');
  expect(client.query.mock.calls.at(-1)[1]).toEqual([5, 'synthetic', "x'); DROP TABLE nope; --", 'Synthetic']);
  expect(client.query.mock.calls.at(-1)[0]).not.toContain('DROP');
  await api.finish(run, 1);
  expect(client.query.mock.calls.at(-1)[0]).toContain('pg_advisory_unlock');
});
