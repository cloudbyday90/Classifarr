/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { createBatchCoordinatorRepository } from '../services/reclassificationBatchCoordinatorRepository.mjs';

let database, repository, batch, item;
beforeEach(() => {
  database = { query: jest.fn().mockResolvedValue({ rows: [] }), withTransaction: callback => callback(database) };
  repository = createBatchCoordinatorRepository(database);
  batch = { id: 1, pause_on_error: true };
  item = { id: 2, execution_order: 1, status: 'pending' };
});
test('acceptance does not execute and duplicate acceptance preserves the due time', async () => {
  database.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
  await repository.start(1);
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(database.query).toHaveBeenCalledWith(expect.stringContaining("WHEN status='executing' THEN next_attempt_at"), [1]);
});
test.each([false, true])('rejected admission distinguishes missing=%s from terminal', async exists => {
  database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: exists ? [{ id: 1 }] : [] });
  await expect(repository.start(1)).rejects.toMatchObject({ status: exists ? 409 : 404 });
});
test('idle claim is one bounded query', async () => {
  expect(await repository.claim()).toBeNull();
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(database.query.mock.calls[0][0]).toContain('LIMIT 1 FOR UPDATE SKIP LOCKED');
});
test.each(['pending', 'executing'])('claim preserves crash provenance for %s item', async status => {
  item.status = status;
  database.query.mockResolvedValueOnce({ rows: [batch] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [item] });
  expect(await repository.claim()).toEqual({ batch, item, interrupted: status === 'executing' });
  const writesVersion = database.query.mock.calls.some(([sql]) => sql.includes('execution_version=1'));
  expect(writesVersion).toBe(status !== 'executing');
});
test('no unfinished items finalizes only a running batch', async () => {
  database.query.mockResolvedValueOnce({ rows: [batch] });
  expect(await repository.claim()).toBeNull();
  expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id=$1 AND status='executing'"), [1]);
});
test('deferral, safe stopped preparation, and success are conditional and parameterized', async () => {
  await repository.defer(1);
  expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining('make_interval'), [1, 30]);
  await repository.stopped(item);
  expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("execution_result->>'moveOperationId' IS NULL"), [2]);
  await repository.success(item, { success: true });
  expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("status IN ('executing','completed')"), [2, '{"success":true}']);
});
test.each([[true, false, true], [false, false, false], [false, true, true]])(
  'failure pause-on-error=%s force=%s pauses=%s', async (pauseOnError, force, paused) => {
    batch.pause_on_error = pauseOnError;
    database.query.mockResolvedValueOnce({ rows: [batch] }).mockResolvedValueOnce({ rows: [item] });
    await repository.failure({ batch, item }, 'bounded message', force);
    expect(database.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(database.query.mock.calls.some(([sql]) => sql.includes("SET status='paused'"))).toBe(paused);
  });
test('a receipt already completed by recovery cannot be marked failed or pause its batch', async () => {
  await repository.failure({ batch, item }, 'error', true);
  expect(database.query).toHaveBeenCalledTimes(2);
});
