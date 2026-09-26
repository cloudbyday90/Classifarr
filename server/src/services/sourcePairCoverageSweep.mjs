/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fingerprintSourcePairEvidence } from './automaticSourcePairComputation.mjs';
import { freezeAutomaticSourcePairCohort } from './automaticSourcePairCohort.mjs';
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';
import { ADJUDICATION_PAIR_LIMIT } from './cachedAdjudicationContract.mjs';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validCursor = value => value && Number.isInteger(value.revision) && value.revision >= 0 && value.revision < 2147483647 &&
  Number.isInteger(value.selectionOffset) && value.selectionOffset >= 0 && value.selectionOffset <= 299 &&
  (value.evidenceRevision === null || digest(value.evidenceRevision));

/** Capture reads the original snapshot. Only automatic diagnostics select the sweep offset. */
export function selectSourcePairSweepSnapshot(snapshot, state, frozen) {
  if (!snapshot.sweepCursor) return snapshot;
  if (!validCursor(snapshot.sweepCursor)) throw new Error('source_pair_sweep_cursor_invalid');
  const cohort = frozen ?? freezeAutomaticSourcePairCohort(snapshot.inputs.source, state, snapshot.observedAt);
  const sweepEvidenceRevision = fingerprintSourcePairEvidence(snapshot, cohort);
  const selectionOffset = snapshot.sweepCursor.evidenceRevision === sweepEvidenceRevision ? snapshot.sweepCursor.selectionOffset : 0;
  return { ...snapshot, sweepEvidenceRevision, inputs: { ...snapshot.inputs,
    source: { ...snapshot.inputs.source, adjudicationSelectionOffset: selectionOffset } } };
}

/** Gaps count as surveyed, never as completed pairs or permission to abandon capture. */
export function planSourcePairSweepAdvance(report, cursor, evidenceRevision) {
  if (!validCursor(cursor) || !digest(evidenceRevision) || !readAutomaticSourcePairReport(report) ||
      report.policyReplay?.status !== 'complete' || report.aiReplay?.version !== 'cached_adjudication_report.v3') return null;
  const replay = report.aiReplay;
  const intended = cursor.evidenceRevision === evidenceRevision ? cursor.selectionOffset : 0;
  const offset = intended < replay.eligible ? intended : 0;
  if (replay.selectionOffset !== offset || replay.selected !== Math.min(ADJUDICATION_PAIR_LIMIT, replay.eligible - offset)) return null;
  const nextOffset = offset + replay.selected >= replay.eligible ? 0 : offset + replay.selected;
  if (nextOffset === cursor.selectionOffset && evidenceRevision === cursor.evidenceRevision) return null;
  return { revision: cursor.revision, selectionOffset: cursor.selectionOffset, evidenceRevision: cursor.evidenceRevision,
    nextOffset, nextEvidenceRevision: evidenceRevision };
}

export const sameSourcePairSweepCursor = (a, b) => validCursor(a) && validCursor(b) &&
  a.revision === b.revision && a.selectionOffset === b.selectionOffset && a.evidenceRevision === b.evidenceRevision;
