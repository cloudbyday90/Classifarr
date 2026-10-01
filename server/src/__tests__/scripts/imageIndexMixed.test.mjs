/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { assertImageIndexMixedReceipt } from '../../scripts/imageIndexMixedContract.mjs';
import { imageIndexMixedReceiptFixture } from '../helpers/imageIndexMixedReceiptFixture.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';

test('aggregate mixed evidence and summary distinguish cancellation and recovery', () => {
  const study = imageIndexMixedReceiptFixture();
  expect(() => assertImageIndexMixedReceipt(study)).not.toThrow();
  const result = { mode: 'image-index-mixed', budget: 'image-capacity', cleanup: 'passed', study };
  expect(formatResourceStudySummary(result)).toContain('Cancellation is intentionally incomplete');
  expect(formatResourceStudySummary(result)).toContain('No AI routing');
  expect(() => formatResourceStudySummary({ ...result, cleanup: 'failed' })).toThrow();
  expect(() => formatResourceStudySummary({ ...result, budget: 'baseline' })).toThrow();
});

test.each([
  s => { s.version = 'v0'; }, s => { s.status = 'passed'; }, s => { s.rows = 1000; },
  s => { s.rowsPreserved = false; }, s => { s.databaseIdle = false; }, s => { s.workersStopped = false; },
  s => { s.invalidObserved = false; }, s => { s.staleClaimRejected = false; },
  s => { s.durationMs = 1200001; }, s => { s.cases.pop(); }, s => { s.cases[0].name = 'secret'; },
  s => { s.cases[0].execution = {}; }, s => { s.cases[1].startedDuringBuild = false; },
  s => { s.cases[1].overlapRetrievals = 0; }, s => { s.cases[1].overlapRetrievals = 41; },
  s => { s.cases[1].execution.exitCode = 83; }, s => { s.cases[1].execution.watchdog = true; },
  s => { s.cases[2].execution.signal = null; }, s => { s.cases[2].acknowledged = true; },
  s => { s.cases[2].workMemMiB = 512; }, s => { s.cases[3].workMemMiB = 64; },
  s => { s.cases[3].validIndexes = 2; }, s => { s.cases[3].foreground.inventory = 1; },
  s => { s.cases[3].foreground.retrievals.count = 39; }, s => { s.cases[0].foreground.scans.p95Ms = NaN; },
  s => { s.cases[0].foreground.scans.p95Ms = 0; }, s => { s.cases[0].containerPeakBytes = null; },
  s => { s.final.oomKill++; }, s => { s.final.memoryLimitHits++; }, s => { s.final.cpuUsec = -1; },
])('rejects unsupported mixed evidence (%#)', mutate => {
  const study = imageIndexMixedReceiptFixture(); mutate(study);
  expect(() => assertImageIndexMixedReceipt(study)).toThrow();
});

test.each(['baseline', 'bounded', 'stress'])('mixed profile refuses incompatible budget before Docker: %s', async budget => {
  const run = jest.fn();
  await expect(runResourceStudyCompose({ mode: 'image-index-mixed', budget, run })).rejects.toThrow('budget_invalid');
  expect(run).not.toHaveBeenCalled();
});
