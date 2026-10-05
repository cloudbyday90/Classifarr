/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { runIngestionSafeguardRepairCommand as run } from '../scripts/runIngestionSafeguardRepair.mjs';
function fixture(reason = 'confirmation_required') {
  const output = jest.fn(), end = jest.fn(), confirm = jest.fn(async () => true);
  const service = { preview: jest.fn(async () => ({ reason, token: reason === 'confirmation_required' ? 'secret-token' : null })), apply: jest.fn(async () => ({ status: 'repaired' })) };
  return { output, confirm, service, end, loadDatabase: async () => ({ pool: { end } }), createService: () => service };
}
test('preview is read-only, omits ephemeral token and closes pool', async () => {
  const f = fixture(); expect(await run({ ...f, args: ['--preview', '--actor', '1'] })).toBe(0);
  expect(f.service.apply).not.toHaveBeenCalled(); expect(f.output.mock.calls.flat().join('')).not.toContain('secret-token');
  expect(f.end).toHaveBeenCalled();
});
test('apply requires explicit confirmation and forwards only a fresh token', async () => {
  const f = fixture(); expect(await run({ ...f, args: ['--apply', '--actor', '1'] })).toBe(0);
  expect(f.service.apply).toHaveBeenCalledWith(1, { token: 'secret-token', confirm: true });
  f.confirm.mockResolvedValue(false);
  expect(await run({ ...f, args: ['--apply', '--actor', '1'] })).toBe(2);
  expect(f.service.apply).toHaveBeenCalledTimes(1);
});
test('invalid arguments, refusal and unexpected errors never leak details', async () => {
  const f = fixture('definition_changed');
  expect(await run({ ...f, args: ['--apply', '--actor', '1'] })).toBe(75);
  expect(await run({ ...f, args: ['--force'] })).toBe(2);
  expect(await run({ ...f, args: ['--help'] })).toBe(0);
  f.service.preview.mockRejectedValue(new Error('secret'));
  expect(await run({ ...f, args: ['--preview', '--actor', '1'] })).toBe(1);
  expect(f.output.mock.calls.flat().join('')).not.toContain('secret');
});
test('cleanup failure does not expose database details or replay a completed repair', async () => {
  const f = fixture(); f.end.mockRejectedValue(new Error('secret connection'));
  expect(await run({ ...f, args: ['--apply', '--actor', '1'] })).toBe(0);
  expect(f.service.apply).toHaveBeenCalledTimes(1);
  expect(f.output.mock.calls.flat().join('')).toContain('cleanup could not be confirmed');
  expect(f.output.mock.calls.flat().join('')).not.toContain('secret');
});
