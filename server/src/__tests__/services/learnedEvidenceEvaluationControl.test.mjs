/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLearnedEvidenceEvaluationControl, resolveLearnedEvidenceEvaluationMode } from '../../services/learnedEvidenceEvaluationControl.mjs';
const config = { rag_enabled: true, primary_provider: 'ollama', ollama_host: 'http://localhost:11434', confirmation_setting: 'false' };

test('only valid server configuration admits evaluation and a caller cannot relax the server hold', () => {
  expect(resolveLearnedEvidenceEvaluationMode(config)).toBe('automatic');
  expect(resolveLearnedEvidenceEvaluationMode(config, true)).toBe('review_only');
  expect(resolveLearnedEvidenceEvaluationMode({ ...config, confirmation_setting: 'true' }, false)).toBe('review_only');
  for (const confirmation_setting of [undefined, null, true, false, '', 'TRUE', ' false ', 0]) {
    expect(resolveLearnedEvidenceEvaluationMode({ ...config, confirmation_setting })).toBeNull();
  }
  for (const flag of [null, 'false', 0, {}]) expect(resolveLearnedEvidenceEvaluationMode(config, flag)).toBeNull();
  for (const value of [null, { ...config, rag_enabled: false }, { ...config, primary_provider: 'remote' },
    { ...config, ollama_host: 'https://example.org' }]) expect(resolveLearnedEvidenceEvaluationMode(value)).toBeNull();
});

test('one bounded slot releases once and old completions cannot release a new attempt', () => {
  const control = createLearnedEvidenceEvaluationControl();
  const first = control.begin();
  expect(first.signal).toBeInstanceOf(AbortSignal);
  expect(control.begin()).toBeNull();
  first.finish('unavailable');
  const second = control.begin();
  first.finish('qualified');
  expect(control.begin()).toBeNull();
  second.finish('strict_qualified_admin_held');
  expect(control.read().counts).toMatchObject({ unavailable: 1, strict_qualified_admin_held: 1, qualified: 0, busy: 2 });
});

test('timer failure never leaves the slot busy and diagnostics stay bounded and content-free', () => {
  const control = createLearnedEvidenceEvaluationControl();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => { throw new Error('timer failed'); });
  try { expect(() => control.begin()).toThrow('timer failed'); } finally { timeout.mockRestore(); }
  control.begin().finish('PRIVATE unknown reason');
  control.record('__proto__'); control.record('PRIVATE unknown reason');
  for (let i = 0; i < 1000002; i++) control.record('qualified');
  const status = control.read();
  expect(status).toMatchObject({ version: 'learned_evidence_evaluation_v1', automaticRouteAllowed: false, counts: { qualified: 1000000 } });
  status.counts.qualified = 0;
  expect(control.read().counts.qualified).toBe(1000000);
  expect(JSON.stringify(status)).not.toContain('PRIVATE');
});

test('guard reasons are bounded, detached and counted once only with a live-guard outcome', () => {
  const control = createLearnedEvidenceEvaluationControl();
  const session = control.begin();
  session.finish('live_guard_blocked', 'item_unusual');
  session.finish('live_guard_blocked', 'item_unusual');
  control.record('qualified', 'item_unusual');
  control.record('live_guard_blocked', 'PRIVATE unknown');
  control.record('live_guard_blocked', '__proto__');
  expect(control.read()).toMatchObject({ counts: { live_guard_blocked: 3 }, guardReasons: { item_unusual: 1 } });
  const snapshot = control.read(); snapshot.guardReasons.item_unusual = 99;
  expect(control.read().guardReasons.item_unusual).toBe(1);
  for (let index = 0; index < 1_000_002; index++) control.record('live_guard_blocked', 'item_unusual');
  expect(control.read().guardReasons.item_unusual).toBe(1_000_000);
  expect(JSON.stringify(control.read())).not.toContain('PRIVATE');
});
