/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runEvidenceGapAuditThread } from '../../services/evidenceGapAuditThreadClient.mjs';
import { gapAuditSnapshot, gapAuditRow, gapAuditReport } from '../fixtures/evidenceGapAuditFixture.mjs';

test('real isolated worker returns only aggregate data and includes window time in the input fingerprint', async () => {
  const snapshot = gapAuditSnapshot([gapAuditRow()]);
  const first = await runEvidenceGapAuditThread(snapshot, null);
  expect(first.report.comparisons.eligible).toBe(1);
  const same = await runEvidenceGapAuditThread(snapshot, { input_fingerprint: first.fingerprint, report: first.report });
  expect(same.unchanged).toBe(true);
  const moved = structuredClone(snapshot);
  moved.observedAt = moved.inputs.observedAt = moved.inputs.window.until = '2026-10-28T12:01:00.000Z';
  moved.inputs.window.since = '2026-09-28T12:01:00.000Z';
  expect((await runEvidenceGapAuditThread(moved, { input_fingerprint: first.fingerprint, report: first.report })).fingerprint).not.toBe(first.fingerprint);
});

test('real worker preserves invalid-evidence failure without private exception text', async () => {
  const snapshot = gapAuditSnapshot([gapAuditRow()]); snapshot.inputs.rows[0].outcomes[0].authorized_snapshot.binding_valid = false;
  await expect(runEvidenceGapAuditThread(snapshot, null)).rejects.toThrow('invalid_report');
});

test('forged output, timeout and cancellation always join the worker before returning', async () => {
  let last;
  class FakeWorker extends EventEmitter {
    constructor(_url, options) { super(); this.options = options; this.terminate = jest.fn(async () => {}); last = this }
  }
  const pending = runEvidenceGapAuditThread(gapAuditSnapshot(), null, undefined, { WorkerClass: FakeWorker });
  expect(last.options.execArgv).toEqual([]); expect(Object.keys(last.options.env).sort()).toEqual(['FILE_LOGGING_ENABLED', 'LOG_LEVEL']);
  last.emit('message', { fingerprint: 'a'.repeat(64), report: { ...gapAuditReport(), private: 'secret' }, unchanged: false });
  await expect(pending).rejects.toThrow('unavailable'); expect(last.terminate).toHaveBeenCalledTimes(1);
  await expect(runEvidenceGapAuditThread(gapAuditSnapshot(), null, undefined, { WorkerClass: FakeWorker, timeoutMs: 5 })).rejects.toThrow('deadline');
  expect(last.terminate).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  const stopped = runEvidenceGapAuditThread(gapAuditSnapshot(), null, controller.signal, { WorkerClass: FakeWorker });
  controller.abort(); await expect(stopped).rejects.toThrow('cancelled'); expect(last.terminate).toHaveBeenCalledTimes(1);
});
