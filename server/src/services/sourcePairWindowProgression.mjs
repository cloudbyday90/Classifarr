/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';
import { fingerprintAutomaticSourcePairInputs } from './automaticSourcePairComputation.mjs';
import { ADJUDICATION_PAIR_LIMIT } from './cachedAdjudicationContract.mjs';
import { selectSourcePairSweepSnapshot, planSourcePairSweepAdvance, sameSourcePairSweepCursor } from './sourcePairCoverageSweep.mjs';

/** Internal scheduling intent, never inference permission or a public report field. */
export function planSourcePairWindowAdvance(report, revision, selectionOffset) {
  if (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647 ||
      !Number.isInteger(selectionOffset) || selectionOffset < 0 || selectionOffset > 299 ||
      !readAutomaticSourcePairReport(report) || report.policyReplay?.status !== 'complete' ||
      report.aiReplay?.version !== 'cached_adjudication_report.v3') return null;
  const replay = report.aiReplay;
  const offset = selectionOffset < replay.eligible ? selectionOffset : 0;
  if (!replay.selected || replay.selectionOffset !== offset ||
      replay.selected !== Math.min(ADJUDICATION_PAIR_LIMIT, replay.eligible - offset) ||
      ![replay.baseline, replay.sourceAware].every(arm => arm.automatic + arm.hits === replay.selected)) return null;
  const nextOffset = offset + replay.selected >= replay.eligible ? 0 : offset + replay.selected;
  return nextOffset === selectionOffset ? null : { revision, selectionOffset, nextOffset };
}

export function createProgressingSourcePairEvaluation({ repository, evaluate }) {
  return async (snapshot, state, signal) => {
    await repository.collectQuality?.(snapshot, signal);
    const selected = selectSourcePairSweepSnapshot(snapshot, state);
    const result = await evaluate(selected, state, signal);
    signal.throwIfAborted();
    const replayWindow = planSourcePairWindowAdvance(result.report, snapshot.adjudicationBudgetRevision,
      snapshot.inputs.source.adjudicationSelectionOffset);
    const sweepWindow = planSourcePairSweepAdvance(result.report, snapshot.sweepCursor, selected.sweepEvidenceRevision);
    if (!replayWindow && !sweepWindow) return result;
    // Admission remains held. Quota changes fence ownership, not the evidence fingerprint.
    const current = await repository.readSnapshot(signal);
    signal.throwIfAborted();
    const fresh = selectSourcePairSweepSnapshot(current, state, result);
    if (fingerprintAutomaticSourcePairInputs(fresh, result) !== result.fingerprint ||
        (snapshot.sweepCursor && !sameSourcePairSweepCursor(snapshot.sweepCursor, current.sweepCursor))) return result;
    const captureCurrent = replayWindow && current.adjudicationBudgetRevision === replayWindow.revision &&
      current.inputs.source.adjudicationSelectionOffset === replayWindow.selectionOffset;
    if (!captureCurrent && !sweepWindow) return result;
    return { ...result, ...(captureCurrent ? { replayWindow } : {}), ...(sweepWindow ? { sweepWindow } : {}) };
  };
}
