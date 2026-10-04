/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readEmbeddedMigrationSelection, selectEmbeddedMigration } from '../bootstrap/embeddedMigrationSelection.mjs';
import { MIGRATION_PHASES, runEmbeddedMigrationPhases } from '../bootstrap/embeddedMigrationPhases.mjs';

const binding = 'a'.repeat(64);
const complete = () => ({ version: 1, binding, completed: 5, pending: null });
function fixture() {
  let selection = null;
  const journal = { read: jest.fn(async () => complete()), write: jest.fn(), selection: {
    read: jest.fn(async () => selection),
    write: jest.fn(async value => { selection = structuredClone(value); }),
  } };
  return { journal, binding, verify: jest.fn(async () => {}) };
}

test('absent receipts do not authorize selection or an implicit legacy fallback', async () => {
  const input = fixture();
  input.journal.read.mockResolvedValue(null);
  await expect(readEmbeddedMigrationSelection(input)).rejects.toThrow('not_ready');
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('not_ready');
  expect(input.verify).not.toHaveBeenCalled();
  expect(input.journal.selection.write).not.toHaveBeenCalled();
});

test('intent is durable before verification and selection follows verification', async () => {
  const input = fixture(), events = [];
  input.verify.mockImplementation(async () => {
    events.push((await input.journal.selection.read()).phase);
    await expect(readEmbeddedMigrationSelection(input)).rejects.toThrow('not_ready');
  });
  expect(await selectEmbeddedMigration(input)).toEqual({ status: 'selected', database: 'candidate', productionCutover: false });
  expect(events).toEqual(['verifying']);
  expect(await readEmbeddedMigrationSelection(input)).toBe('candidate');
  expect(input.journal.write).not.toHaveBeenCalled();
});

test.each(['before:verify', 'verified', 'selected'])('resumes real selection state after interruption at %s', async fault => {
  const input = fixture();
  await expect(selectEmbeddedMigration({ ...input, checkpoint: async point => {
    if (point === fault) throw new Error('interrupted');
  } })).rejects.toThrow('interrupted');
  expect((await input.journal.selection.read()).phase).toBe(fault === 'selected' ? 'selected' : 'verifying');
  input.verify.mockClear();
  await selectEmbeddedMigration(input);
  expect(input.verify).toHaveBeenCalledTimes(1);
  expect(await readEmbeddedMigrationSelection(input)).toBe('candidate');
  expect(input.journal.selection.write).toHaveBeenCalledTimes(fault === 'selected' ? 3 : 2);
});

test.each([null, {}, { ...complete(), completed: 4 }, { ...complete(), pending: 'verification', completed: 4 },
  { ...complete(), binding: 'b'.repeat(64) }, { ...complete(), version: 2 }])('missing or incomplete migration cannot select a copy: %j', async receipt => {
  const input = fixture();
  input.journal.read.mockResolvedValue(receipt);
  await input.journal.selection.write({ version: 1, binding, phase: 'selected' });
  input.journal.selection.write.mockClear();
  await expect(selectEmbeddedMigration(input)).rejects.toThrow();
  await expect(readEmbeddedMigrationSelection(input)).rejects.toThrow();
  expect(input.verify).not.toHaveBeenCalled();
  expect(input.journal.selection.write).not.toHaveBeenCalled();
});

test.each([{}, { version: 2, binding, phase: 'selected' }, { version: 1, binding, phase: 'legacy' },
  { version: 1, binding: 'b'.repeat(64), phase: 'selected' },
  { version: 1, binding, phase: 'selected', path: '/other' }, false, [], 'selected'])('rejects malformed selection %j before effects', async receipt => {
  const input = fixture();
  input.journal.selection.read.mockResolvedValue(receipt);
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('selection_invalid');
  await expect(readEmbeddedMigrationSelection(input)).rejects.toThrow('selection_invalid');
  expect(input.verify).not.toHaveBeenCalled();
  expect(input.journal.selection.write).not.toHaveBeenCalled();
});

test('verification failure leaves pending intent; selected restart failure never rolls back', async () => {
  const input = fixture();
  input.verify.mockRejectedValueOnce(new Error('boundary_changed'));
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('boundary_changed');
  expect((await input.journal.selection.read()).phase).toBe('verifying');
  await selectEmbeddedMigration(input);
  input.journal.selection.write.mockClear();
  input.verify.mockRejectedValueOnce(new Error('boundary_changed'));
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('boundary_changed');
  expect(await readEmbeddedMigrationSelection(input)).toBe('candidate');
  expect(input.journal.selection.write).not.toHaveBeenCalled();
});

test.each(['intent', 'commit'])('failed durable %s write prevents successful selection', async point => {
  const input = fixture();
  const write = input.journal.selection.write.getMockImplementation();
  input.journal.selection.write.mockImplementation(async value => {
    if (value.phase === (point === 'intent' ? 'verifying' : 'selected')) throw new Error('fsync_failed');
    await write(value);
  });
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('fsync_failed');
  expect(input.verify).toHaveBeenCalledTimes(point === 'intent' ? 0 : 1);
  await expect(readEmbeddedMigrationSelection(input)).rejects.toThrow('not_ready');
});

test('uncertain commit after rename re-syncs selected state without replaying copy or resetting selection', async () => {
  const input = fixture(), write = input.journal.selection.write.getMockImplementation();
  input.journal.selection.write.mockImplementation(async value => {
    await write(value);
    if (value.phase === 'selected') throw new Error('directory_sync_failed');
  });
  await expect(selectEmbeddedMigration(input)).rejects.toThrow('directory_sync_failed');
  input.journal.selection.write.mockClear().mockImplementation(write);
  await selectEmbeddedMigration(input);
  expect(input.journal.selection.write).toHaveBeenCalledTimes(1);
  expect(input.journal.selection.write).toHaveBeenCalledWith({ version: 1, binding, phase: 'selected' });
  expect(input.verify).toHaveBeenCalledTimes(2);
});

test.each(['verifying', 'selected', 'malformed'])('conversion cannot overwrite candidate after %s intent even if migration receipt was lost', async phase => {
  const input = fixture();
  input.journal.read.mockResolvedValue(null);
  input.journal.selection.read.mockResolvedValue({ version: 1, binding, phase });
  const steps = Object.fromEntries(['prepare', ...MIGRATION_PHASES].map(key => [key, jest.fn()]));
  await expect(runEmbeddedMigrationPhases({ ...input, steps })).rejects.toThrow('selection_requires_resume');
  expect(input.journal.read).not.toHaveBeenCalled();
  for (const step of Object.values(steps)) expect(step).not.toHaveBeenCalled();
});

test('missing verifier and invalid binding fail before effects', async () => {
  const input = fixture();
  await expect(selectEmbeddedMigration({ ...input, verify: null })).rejects.toThrow('verifier_required');
  await expect(selectEmbeddedMigration({ ...input, binding: 'bad' })).rejects.toThrow('binding_invalid');
  expect(input.journal.read).not.toHaveBeenCalled();
});

test('conversion requires a selection store so old adapters cannot bypass the recopy guard', async () => {
  const input = fixture();
  delete input.journal.selection;
  const steps = Object.fromEntries(['prepare', ...MIGRATION_PHASES].map(key => [key, jest.fn()]));
  await expect(runEmbeddedMigrationPhases({ ...input, steps })).rejects.toThrow('selection_store_required');
  expect(input.journal.read).not.toHaveBeenCalled();
});
