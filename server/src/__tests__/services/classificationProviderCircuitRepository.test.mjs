/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: jest.fn() }));
const { ClassificationProviderCircuitRepository } = await import('../../services/classificationProviderCircuitRepository.mjs');
let database, repository;
beforeEach(() => {
  database = { query: jest.fn().mockResolvedValue({ rows: [] }), withTransaction: fn => fn(database) };
  repository = new ClassificationProviderCircuitRepository({ database });
});
test('atomically consumes a half-open slot', async () => {
  database.query.mockResolvedValueOnce({ rows: [{ epoch: '2' }] });
  expect(await repository.admit('key')).toEqual({ key: 'key', epoch: '2' });
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(database.query.mock.calls[0][0]).toContain('trial_remaining = trial_remaining - 1');
});
test.each([null, { state: 'closed', epoch: 3 }, { state: 'open', epoch: 1 }, { state: 'half_open', epoch: 2 }])('reads current admission state %#', async row => {
  database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: row ? [row] : [] });
  expect(await repository.admit('key')).toEqual(!row || row.state === 'closed' ? { key: 'key', epoch: row?.epoch ?? 0 } : null);
});
test.each(['insert', 'update', 'stale'])('opens the circuit using epoch CAS (%s)', async mode => {
  database.query.mockImplementation(async sql => ({ rows:
    (mode === 'insert' && sql.includes('INSERT INTO classification_provider_circuits')) ||
    (mode === 'update' && sql.startsWith('UPDATE classification_provider_circuits')) ? [{ dependency_key: 'key' }] : [] }));
  expect(await repository.open({ key: 'key', epoch: mode === 'insert' ? 0 : 3 }, 'ai_timeout')).toBe(mode !== 'stale');
  const calls = database.query.mock.calls.map(([sql]) => sql);
  expect(calls[1]).toContain('FOR UPDATE');
  expect(calls.some(sql => sql.includes('GREATEST'))).toBe(mode !== 'stale');
});
test('same proof cannot replenish the trial batch', async () => {
  await repository.grantTrial(database, 'key', 'lease');
  expect(database.query).toHaveBeenCalledWith(expect.stringContaining('last_probe_token IS DISTINCT FROM'), ['key', 'lease']);
});
test.each([{ rows: [] }, { rows: [{ dependency_key: 'key' }] }])('only closes the matching half-open generation %#', async ({ rows }) => {
  database.query.mockResolvedValue({ rows });
  expect(await repository.close({ key: 'key', epoch: 2 })).toBe(rows.length > 0);
  expect(database.query).toHaveBeenCalledWith(expect.stringContaining("state = 'half_open'"), ['key', 2]);
});
