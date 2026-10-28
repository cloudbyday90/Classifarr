/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import * as db from '../config/database.mjs';
import { createAutomaticEvidenceGapAudit } from './automaticEvidenceGapAudit.mjs';

export const EVIDENCE_GAP_AUDIT_TASK = 'evidence-gap-audit';
export const EVIDENCE_GAP_AUDIT_STARTUP_MS = 240000;
export function registerEvidenceGapAuditSchedule(scheduler, {
  worker = createAutomaticEvidenceGapAudit(db), steadyNow = () => performance.now(),
} = {}) {
  scheduler.evidenceGapAuditWorker?.stop();
  scheduler.evidenceGapAuditWorker = worker;
  const start = steadyNow();
  const run = async () => {
    // Cron may tick before the delayed initial task. Gate both entry points.
    if (steadyNow() - start < EVIDENCE_GAP_AUDIT_STARTUP_MS) return { status: 'deferred', reason: 'startup' };
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('evidence_gap_audit_unavailable');
    return result;
  };
  scheduler.schedule(EVIDENCE_GAP_AUDIT_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(EVIDENCE_GAP_AUDIT_TASK, EVIDENCE_GAP_AUDIT_STARTUP_MS, run);
}
