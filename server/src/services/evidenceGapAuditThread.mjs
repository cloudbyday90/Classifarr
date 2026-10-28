/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { createHash } from 'node:crypto';
import { buildEvidenceGapAudit } from './evidenceGapAuditProjection.mjs';
import { GAP_AUDIT_VERSION, readEvidenceGapAuditReport } from './evidenceGapAuditContract.mjs';

if (workerData?.role !== 'evidence-gap-audit') throw new Error('evidence_gap_audit_thread_role');
const { inputs, state } = workerData;
// Include the complete fixed window: unchanged counts cannot refresh an older source snapshot.
const fingerprint = createHash('sha256').update(serialize({ revision: GAP_AUDIT_VERSION, inputs })).digest('hex');
const unchanged = state?.input_fingerprint === fingerprint && readEvidenceGapAuditReport(state.report) !== null;
try {
  const report = unchanged ? state.report : buildEvidenceGapAudit(inputs);
  parentPort.postMessage({ fingerprint, report, unchanged });
} catch (error) {
  const failure = ['inventory_prospective_budget', 'inventory_prospective_library_budget'].includes(error?.message) ? 'evidence_budget'
    : /^(authorized_evaluation_invalid_|inventory_prospective_invalid_|inventory_prospective_activity_invalid|evidence_gap_audit_invalid_)/.test(error?.message ?? '')
      ? 'invalid_evidence' : 'evaluation_unavailable';
  parentPort.postMessage({ failure });
}
