/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { MIGRATION_PHASES, runEmbeddedMigrationPhases, validateMigrationReceipt } from '../bootstrap/embeddedMigrationPhases.mjs';

const binding = 'a'.repeat(64);
const valid = () => ({ version: 1, binding, completed: 0, pending: null });
const fixture = () => {
  let state = null;
  const journal = { read: jest.fn(async () => state), write: jest.fn(async value => { state = structuredClone(value); }),
    selection: { read: jest.fn(async () => null) } };
  const steps = Object.fromEntries(['prepare', ...MIGRATION_PHASES].map(phase => [phase, jest.fn(async () => {})]));
  return { journal, steps, binding };
};

test('write-ahead intent precedes each effect and completed receipt still requires verification', async () => {
  const input = fixture();
  const events = [];
  input.journal.write.mockImplementation(async state => { events.push(`write:${state.completed}:${state.pending}`); });
  for (const phase of MIGRATION_PHASES) input.steps[phase].mockImplementation(async () => { events.push(phase); });
  await expect(runEmbeddedMigrationPhases(input)).resolves.toEqual({ status: 'verified', productionCutover: false });
  expect(events.slice(0, 3)).toEqual(['write:0:copy', 'copy', 'write:1:null']);
  expect(events.at(-1)).toBe('verification');
});

test.each(MIGRATION_PHASES.flatMap(phase => ['before', 'applied', 'after'].map(point => `${point}:${phase}`)))('resumes %s without skipping an unreceipted effect', async fault => {
  const input = fixture();
  await expect(runEmbeddedMigrationPhases({ ...input, checkpoint: async point => { if (point === fault) throw new Error('interrupted'); } })).rejects.toThrow('interrupted');
  const [point, phase] = fault.split(':');
  const prior = input.steps[phase].mock.calls.length;
  await runEmbeddedMigrationPhases(input);
  expect(input.steps[phase].mock.calls.length).toBe(prior + (point === 'after' ? 0 : 1) + (phase === 'verification' ? 1 : 0));
  expect((await input.journal.read()).completed).toBe(5);
});

test.each([
  {}, { version: 2 }, { binding: 'b'.repeat(64) }, { completed: -1 }, { completed: 6 }, { completed: 0.5 },
  { pending: 'roles' }, { completed: 5, pending: 'verification' }, { completed: 5, pending: undefined }, { extra: true },
])('rejects invalid receipt %j', async change => {
  const input = fixture();
  input.journal.read.mockResolvedValue(Object.keys(change).length ? { ...valid(), ...change } : {});
  await expect(runEmbeddedMigrationPhases(input)).rejects.toThrow('migration_receipt_invalid');
  expect(input.steps.prepare).not.toHaveBeenCalled();
});
test.each([null, '', 'a'.repeat(65), 'a'.repeat(64) + '\n', 123])('rejects invalid binding %j', value => {
  expect(() => validateMigrationReceipt(null, value)).toThrow('migration_binding_invalid');
});
test('bad journal JSON and failed durable writes never advance work', async () => {
  const input = fixture();
  input.journal.write.mockRejectedValue(new Error('fsync_failed'));
  await expect(runEmbeddedMigrationPhases(input)).rejects.toThrow('fsync_failed');
  expect(input.steps.copy).not.toHaveBeenCalled();
});
test('completed receipt never bypasses changed boundary verification', async () => {
  const input = fixture();
  await runEmbeddedMigrationPhases(input);
  input.steps.verification.mockRejectedValue(new Error('boundary_changed'));
  await expect(runEmbeddedMigrationPhases(input)).rejects.toThrow('boundary_changed');
  expect(input.steps.copy).toHaveBeenCalledTimes(1);
});
test('missing effect implementation fails before reading journal', async () => {
  const input = fixture();
  delete input.steps.roles;
  await expect(runEmbeddedMigrationPhases(input)).rejects.toThrow('migration_steps_invalid');
  expect(input.journal.read).not.toHaveBeenCalled();
});
