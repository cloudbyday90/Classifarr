/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export const RESTORE_STUDY = Object.freeze({ cycles: 5, baselineMs: 60000, quietMs: 60000, tailMs: 300000,
  restoreMs: 180000, naturalMs: 1560000, allocationsMs: 960000, maxSamples: 2048 });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function restoreStudyLane(lane) { assert.ok(['natural','allocations'].includes(lane), 'restore_study_lane'); return lane; }
export function validateRestoreIdentity(value) {
  assert.deepEqual(Object.keys(value).sort(), ['archiveId','dumpBytes','dumpSha256','manifestSha256','sourceSha256']);
  assert.ok(uuid(value.archiveId) && hash(value.dumpSha256) && hash(value.manifestSha256) && hash(value.sourceSha256));
  assert.ok(Number.isSafeInteger(value.dumpBytes) && value.dumpBytes > 220000000 && value.dumpBytes <= 268435456);
  return value;
}
export function requireRestoreReceipt(receipt, identity) {
  validateRestoreIdentity(identity);
  assert.deepEqual(receipt, { kind: 'catalog_verification', version: 1, archiveId: identity.archiveId,
    manifestSha256: identity.manifestSha256, dumpSha256: identity.dumpSha256, rowsRestored: true,
    dependenciesAvailable: true, runtimeEnabled: false, purgeAuthorized: false });
}

/** Fixed finite sequence. A refusal/cancellation is not retried or counted as a completed cycle. */
export async function runRestoreStudySequence({ lane, signal, restore, pause, boundary }) {
  restoreStudyLane(lane); signal.throwIfAborted();
  await boundary('baseline', 0);
  if (lane === 'natural') await pause(RESTORE_STUDY.baselineMs);
  for (let cycle = 1; cycle <= RESTORE_STUDY.cycles; cycle++) {
    signal.throwIfAborted(); await boundary('restore', cycle); await restore(cycle);
    signal.throwIfAborted(); await boundary('quiet', cycle);
    if (lane === 'natural' && cycle < RESTORE_STUDY.cycles) await pause(RESTORE_STUDY.quietMs);
  }
  await boundary('tail', RESTORE_STUDY.cycles);
  if (lane === 'natural') await pause(RESTORE_STUDY.tailMs);
  signal.throwIfAborted();
}
