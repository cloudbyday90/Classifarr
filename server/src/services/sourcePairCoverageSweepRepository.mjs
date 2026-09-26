/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { planSourcePairSweepAdvance } from './sourcePairCoverageSweep.mjs';

export async function readSourcePairSweepCursor(client) {
  const { rows } = await client.query(`SELECT revision,selection_offset AS "selectionOffset",evidence_revision AS "evidenceRevision"
    FROM automatic_source_pair_sweep WHERE singleton=true`);
  return rows[0] ?? { revision: 0, selectionOffset: 0, evidenceRevision: null };
}

/** The report/history owner supplies the transaction. Never touches capture state. */
export async function advanceSourcePairSweep(client, report, window) {
  const expected = planSourcePairSweepAdvance(report, window, window?.nextEvidenceRevision);
  if (!expected || Object.keys(window).length !== 5 || window.nextOffset !== expected.nextOffset) {
    throw new Error('source_pair_sweep_transition_invalid');
  }
  await client.query('INSERT INTO automatic_source_pair_sweep(singleton) VALUES(true) ON CONFLICT DO NOTHING');
  const saved = await client.query(`UPDATE automatic_source_pair_sweep SET
    revision=revision+1,selection_offset=$4,evidence_revision=$5
    WHERE singleton=true AND revision=$1 AND selection_offset=$2 AND evidence_revision IS NOT DISTINCT FROM $3`,
  [expected.revision, expected.selectionOffset, expected.evidenceRevision, expected.nextOffset, expected.nextEvidenceRevision]);
  return saved.rowCount === 1;
}
