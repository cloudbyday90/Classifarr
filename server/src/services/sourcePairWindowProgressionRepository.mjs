/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { planSourcePairWindowAdvance } from './sourcePairWindowProgression.mjs';
import { PRUNE_ADJUDICATION_PROGRESS_SQL } from './adjudicationBudgetSql.mjs';

const advanceSql = `UPDATE adjudication_capture_budget SET
  selection_offset=$3,revision=revision+1,published_fingerprint=NULL,
  progress_key=NULL,progress=NULL,captured_at=NULL,expires_at=NULL
  WHERE singleton=true AND revision=$1 AND selection_offset=$2
    AND ((progress IS NULL AND published_fingerprint IS NULL) OR published_fingerprint=$4)`;

/** Caller owns the report/history transaction. A CAS miss is a safe non-advance. */
export async function advanceEvaluatedSourcePairWindow(client, fingerprint, report, window) {
  const expected = planSourcePairWindowAdvance(report, window?.revision, window?.selectionOffset);
  if (!expected || typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint) ||
      Object.keys(window).length !== 3 || window.nextOffset !== expected.nextOffset) {
    throw new Error('source_pair_window_transition_invalid');
  }
  await client.query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true) ON CONFLICT DO NOTHING');
  await client.query(PRUNE_ADJUDICATION_PROGRESS_SQL);
  await client.query(advanceSql, [expected.revision, expected.selectionOffset, expected.nextOffset, fingerprint]);
}
