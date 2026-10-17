/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogModel, catalogModelDue, catalogModelStep } from './fixtures/gatewayCatalogModel.mjs';
import { archiveDue } from '../ollamaGateway/archiveSchedule.mjs';

const id = number => `019a0000-0000-7000-8000-${String(number).padStart(12, '0')}`;
const hash = 'a'.repeat(64), digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const step = (state, type, extra = {}) => catalogModelStep(state, { type, id: state.jobs.at(-1)?.id, ...extra });
function capture(state, number = state.jobs.length + 1, secondCopy = false) {
  state = step(state, 'admit', { id: id(number), secondCopy });
  return step(state, 'snapshot');
}
function finish(state) {
  return step(step(state, 'publish', { manifest: hash }), 'receipt', { manifest: hash, verified: true });
}

test.each([
  [{ enabled: false }, 'disabled'], [{ bindings: 0 }, 'empty'],
  [{ consistent: false }, 'source_inconsistent'], [{ sameIdentity: false }, 'identity_changed'],
])('model refusal gate %j does not create work', (changes, expected) => {
  const state = { ...catalogModel(), ...changes };
  expect(catalogModelDue(state)).toBe(expected); expect(() => capture(state)).toThrow();
  expect(state.jobs).toEqual([]);
});

test('snapshot includes its unfinished job; completion does not rewrite it or cause another capture', () => {
  let state = capture(catalogModel());
  const snapshot = structuredClone(state.jobs[0].snapshot), rawBefore = digest(state.jobs);
  expect(snapshot.jobs[0]).toMatchObject({ status: 'exporting', manifest: null, attempt: 1 });
  state = finish(state);
  expect(state.jobs[0].snapshot).toEqual(snapshot);
  expect(digest(state.jobs)).not.toBe(rawBefore); // Counterexample to hashing all bookkeeping as new intent.
  for (let day = 0; day < 30; day++) {
    state = step(step(state, 'restart'), 'tick', { ms: 86400000 });
    expect(catalogModelDue(state)).toBe('unchanged');
  }
});

test.each(['protection', 'cleanup_attempt', 'cleanup_confirmation', 'retirement'])('%s-only changes remain visible without changing attempt identity', kind => {
  let state = finish(capture(catalogModel()));
  state = step(state, 'maintenance', { kind, value: 'new' });
  expect(state.history).toBe(1); expect(catalogModelDue(state)).toBe('not_due');
  state = step(state, 'tick', { ms: 86400000 }); expect(catalogModelDue(state)).toBe('due');
  state = capture(state); expect(state.jobs.at(-1).attempt).toBe(2);
  expect(state.jobs.at(-1).snapshot.maintenance).toEqual([{ kind, value: 'new' }]);
  state = finish(state); expect(catalogModelDue(state)).toBe('unchanged');
});

test('actual capture, not the earlier assessment, owns the maintenance watermark', () => {
  let state = step(catalogModel(), 'admit', { id: id(1) });
  state = step(state, 'maintenance', { kind: 'cleanup_confirmation', value: 'before capture' });
  state = step(state, 'snapshot');
  expect(state.jobs[0].snapshot.generation).toBe(1);
  state = step(state, 'maintenance', { kind: 'protection', value: 'after capture' });
  state = finish(state);
  expect(state.jobs[0].snapshot.generation).toBe(1);
  expect(catalogModelDue(step(state, 'tick', { ms: 86400000 }))).toBe('due');
});

test.each(['cancelled', 'export_failed'])('%s consumes attempts and restart never refunds them', reason => {
  let state = catalogModel();
  for (let attempt = 1; attempt <= 3; attempt++) {
    state = step(capture(state), 'fail', { reason });
    const raw = digest(state.jobs); state = step(state, 'maintenance', { kind: 'cleanup_attempt', value: attempt });
    state = step(JSON.parse(JSON.stringify(state)), 'restart');
    expect(digest(state.jobs)).toBe(raw); expect(state.jobs.at(-1).attempt).toBe(attempt);
    if (attempt < 3) {
      expect(catalogModelDue(state)).toBe('cooldown');
      const wait = state.jobs.at(-1).retryAfter - state.clock;
      expect(catalogModelDue(step(state, 'tick', { ms: wait - 1 }))).toBe('cooldown');
      state = step(state, 'tick', { ms: wait }); expect(catalogModelDue(state)).toBe('due');
    }
  }
  expect(catalogModelDue(step(state, 'tick', { ms: 86400000 }))).toBe('attempts_exhausted');
});

test('ambiguous publication blocks after restart; age and a late receipt are not recovery authority', () => {
  let state = capture(catalogModel()); state = step(state, 'restart');
  state = step(state, 'tick', { ms: 86400000 * 365 });
  expect(catalogModelDue(state)).toBe('pending');
  expect(() => step(state, 'publish', { manifest: hash })).toThrow();
  expect(() => step(state, 'receipt', { manifest: hash, verified: true })).toThrow();
  expect(state.jobs[0].attempt).toBe(1);
});

test('duplicate receipt is a no-op; changed, reordered and stale receipts cannot change history', () => {
  let state = capture(catalogModel());
  expect(() => step(state, 'receipt', { manifest: hash, verified: true })).toThrow();
  state = finish(state);
  expect(step(state, 'receipt', { manifest: hash, verified: true })).toEqual(state);
  expect(() => step(state, 'receipt', { manifest: 'b'.repeat(64), verified: true })).toThrow();
  expect(() => step(state, 'receipt', { manifest: hash, verified: false })).toThrow();
  state = step(state, 'maintenance', { kind: 'protection', value: 'new' });
  state = capture(step(state, 'tick', { ms: 86400000 }));
  const before = structuredClone(state);
  state = step(state, 'receipt', { id: id(1), manifest: hash, verified: true });
  expect(state).toEqual(before); expect(catalogModelDue(state)).toBe('pending');
});

test('second copies and catalog-only refreshes share the conservative three-attempt limit', () => {
  let state = finish(capture(catalogModel()));
  state = finish(capture(state, 2, true));
  state = step(state, 'maintenance', { kind: 'cleanup_confirmation', value: 'confirmed' });
  state = finish(capture(step(state, 'tick', { ms: 86400000 })));
  state = step(state, 'maintenance', { kind: 'retirement', value: 'independent' });
  expect(catalogModelDue(state)).toBe('attempts_exhausted');
  // New inference history is different intent; new verification UUIDs are not.
  state = step(state, 'history'); expect(catalogModelDue(state)).toBe('not_due');
});

test('restore preserves budgets, pending state and historical values but disables all modeled work', () => {
  const state = step(capture(catalogModel()), 'fail', { reason: 'cancelled' });
  const restored = step(state, 'restore');
  expect(restored.jobs).toEqual(state.jobs); expect(restored.runtimeEnabled).toBe(false);
  expect(catalogModelDue(restored)).toBe('disabled'); expect(() => capture(restored)).toThrow();
});

test('model legacy projection agrees with production schedule across 3 attempts, gates and clock boundaries', () => {
  const clocks = [0, 299999, 300000, 1799999, 1800000, 3599999, 3600000, 86399999, 86400000];
  for (const bindings of [0, 1, 79999, 80000, 100000]) for (const clock of clocks) {
    for (const status of ['failed', 'exporting', 'awaiting_verification', 'interrupted', 'verified', 'retired']) {
      for (const attempt of [1, 2, 3]) for (const sameHistory of [true, false]) {
        const state = { ...catalogModel(), clock, bindings, jobs: [{ id: id(1), history: sameHistory ? 1 : 0,
          status, attempt, completedAt: 0, retryAfter: status === 'failed' ? (attempt === 1 ? 300000 : 1800000) : null,
          snapshot: { generation: 0 } }] };
        const jobs = state.jobs.map(job => ({ ledger_id: id(9), provider_hash: hash, revision: String(job.history),
          status, attempt, completed_at: new Date(job.completedAt), retry_after: job.retryAfter === null ? null : new Date(job.retryAfter) }));
        const actual = archiveDue({ report: { ledgerId: id(9), providerHash: hash, counterMatches: true,
          legacyActiveWithoutBinding: false, counts: { request_binding: bindings }, bindingCount: bindings },
        revision: '1', jobs, now: clock });
        expect(actual).toBe(catalogModelDue(state));
      }
    }
  }
});

test('bounded reordered event exploration never refunds attempts, mutates snapshots, or enables a restored worker', () => {
  let random = 0x49cafe;
  for (let walk = 0; walk < 128; walk++) {
    let state = catalogModel();
    for (let depth = 0; depth < 64; depth++) {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      const idValue = state.jobs.at(-1)?.id;
      const events = [
        { type: 'admit', id: id(state.jobs.length + 1) }, { type: 'snapshot', id: idValue },
        { type: 'publish', id: idValue, manifest: hash }, { type: 'receipt', id: idValue, manifest: hash, verified: true },
        { type: 'receipt', id: idValue, manifest: 'b'.repeat(64), verified: true },
        { type: 'fail', id: idValue, reason: 'cancelled' }, { type: 'restart' },
        { type: 'tick', ms: 86400000 }, { type: 'maintenance', kind: 'cleanup_confirmation', value: depth },
        { type: 'history' }, { type: 'restore' },
      ];
      const before = structuredClone(state);
      try { state = catalogModelStep(state, events[(random >>> 0) % events.length]); }
      catch (error) { expect(error.code).toBe('ERR_ASSERTION'); expect(state).toEqual(before); }
      for (const prior of before.jobs) {
        const after = state.jobs.find(job => job.id === prior.id);
        expect(after.attempt).toBe(prior.attempt); expect(after.history).toBe(prior.history);
        if (prior.snapshot) expect(after.snapshot).toEqual(prior.snapshot);
      }
      expect(state.jobs.filter(job => ['exporting', 'awaiting_verification', 'interrupted'].includes(job.status)).length).toBeLessThanOrEqual(1);
      expect(state.runtimeEnabled).toBe(false);
      if (!before.enabled) expect(state.enabled).toBe(false);
      expect(state.jobs.every(job => job.attempt <= 3)).toBe(true);
    }
  }
});
