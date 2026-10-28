/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAutomaticEvaluationWorker } from './automaticEvaluationWorker.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { createEvidenceGapAuditRepository } from './evidenceGapAuditRepository.mjs';
import { runEvidenceGapAuditThread } from './evidenceGapAuditThreadClient.mjs';
import { GAP_AUDIT_DEFERRALS } from './evidenceGapAuditContract.mjs';

export const EVIDENCE_GAP_AUDIT_LOCK = 0x45474155;
const budgetErrors = new Set(['evidence_gap_audit_input_budget', 'inventory_prospective_budget', 'inventory_prospective_library_budget']);
export function evidenceGapAuditFailure(error) {
  if (GAP_AUDIT_DEFERRALS.includes(error?.reason)) return error.reason;
  if (error?.message === 'evidence_gap_audit_busy') return 'busy';
  if (budgetErrors.has(error?.message)) return 'evidence_budget';
  if (error?.code === '57014' || error?.name === 'AbortError' || error?.message === 'evidence_gap_audit_deadline') return 'deadline';
  if (/^(authorized_evaluation_invalid_|inventory_prospective_invalid_|inventory_prospective_activity_invalid|evidence_gap_audit_invalid_)/.test(error?.message ?? '')) return 'invalid_evidence';
  return 'evaluation_unavailable';
}

export function createAutomaticEvidenceGapAudit(database, {
  repository = createEvidenceGapAuditRepository(database), withAdmission = createInventoryDiscoveryAdmission(database),
  runThread = runEvidenceGapAuditThread, now = Date.now,
} = {}) {
  return createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock: database.withSessionAdvisoryLock,
    lock: EVIDENCE_GAP_AUDIT_LOCK, now, failureCode: evidenceGapAuditFailure, deferredCodes: GAP_AUDIT_DEFERRALS,
    withEvaluation: (callback, signal) => withAdmission(async admitted => {
      await repository.assertIdle(admitted);
      return callback(admitted);
    }, { signal }),
    runEvaluation: runThread,
  });
}
