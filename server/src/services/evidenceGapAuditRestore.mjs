/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Caller owns the existing restore transaction and exclusive maintenance admission. */
export async function resetEvidenceGapAuditForRestore(client) {
  await client.query('DELETE FROM automatic_evidence_gap_audit');
}
