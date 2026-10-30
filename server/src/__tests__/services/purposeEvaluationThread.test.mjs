/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runPurposeEvaluationThread } from '../../services/purposeEvaluationThreadClient.mjs';
import { purposeEvaluationSnapshot, purposeEvaluationReport } from '../fixtures/automaticPurposeFixture.mjs';
import { purposeCohortRow } from '../fixtures/purposeOutcomeFixture.mjs';

test('real isolated worker emits only the aggregate and binds its fingerprint to the exact source window', async () => {
  const snapshot = purposeEvaluationSnapshot([purposeCohortRow({ destination: 5 })]);
  const first = await runPurposeEvaluationThread(snapshot, null);
  expect(first.report.eligible).toBe(1); expect(first.unchanged).toBe(false);
  expect(JSON.stringify(first.report)).not.toMatch(/classificationId|tmdbId|actor|identityKey|snapshot|libraryId/);
  expect((await runPurposeEvaluationThread(snapshot, { input_fingerprint: first.fingerprint, report: first.report })).unchanged).toBe(true);
  const moved = structuredClone(snapshot); moved.observedAt = moved.inputs.observedAt = moved.inputs.window.until = '2026-10-29T12:01:00.000Z';
  moved.inputs.window.since = '2026-09-29T12:01:00.000Z';
  expect((await runPurposeEvaluationThread(moved, { input_fingerprint: first.fingerprint, report: first.report })).fingerprint).not.toBe(first.fingerprint);
});
test('worker classifies invalid source evidence without exposing exception data', async () => {
  const snapshot = purposeEvaluationSnapshot([purposeCohortRow()]); snapshot.inputs.rows[0].source.authorized_snapshot.binding_valid = false;
  await expect(runPurposeEvaluationThread(snapshot, null)).rejects.toThrow('invalid_report');
});
test('forged output, cancellation and deadline join the worker before ownership can release', async () => {
  let last;
  class FakeWorker extends EventEmitter {
    constructor(_url, options) { super(); this.options = options; this.terminate = jest.fn(async () => {}); last = this; }
  }
  const pending = runPurposeEvaluationThread(purposeEvaluationSnapshot(), null, undefined, { WorkerClass: FakeWorker });
  expect(last.options.execArgv).toEqual([]); expect(Object.keys(last.options.env).sort()).toEqual(['FILE_LOGGING_ENABLED', 'LOG_LEVEL']);
  last.emit('message', { fingerprint: 'a'.repeat(64), report: { ...purposeEvaluationReport(), private: 'SECRET' }, unchanged: false });
  await expect(pending).rejects.toThrow('unavailable'); expect(last.terminate).toHaveBeenCalledTimes(1);
  await expect(runPurposeEvaluationThread(purposeEvaluationSnapshot(), null, undefined, { WorkerClass: FakeWorker, timeoutMs: 5 })).rejects.toThrow('deadline');
  expect(last.terminate).toHaveBeenCalledTimes(1);
  const controller = new AbortController(), stopped = runPurposeEvaluationThread(purposeEvaluationSnapshot(), null, controller.signal, { WorkerClass: FakeWorker });
  controller.abort(); await expect(stopped).rejects.toThrow('cancelled'); expect(last.terminate).toHaveBeenCalledTimes(1);
});
