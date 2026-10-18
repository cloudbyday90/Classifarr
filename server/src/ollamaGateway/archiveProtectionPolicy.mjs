/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateRetentionInventory } from './archiveRetentionContract.mjs';
import { validateReceiptForArchive } from './archiveReceiptBinding.mjs';
import { ARCHIVE_POLICY } from './archiveSchedule.mjs';

export function candidateBatchSha256(inventory) {
  validateRetentionInventory(inventory,inventory?.totalCandidates);
  return createHash('sha256').update(JSON.stringify(inventory.entries.map(
    ({ bindingId,requestId,attempt,rowSha256 }) => ({ bindingId,requestId,attempt,rowSha256 })))).digest('hex');
}

/** This is archive readiness, never deletion authority. Live rows must be revalidated by any future cleanup. */
export function archiveProtectionPlan({ report,inventory,jobs,revision,compatibleRevisions = [revision],cleanupOperations = null }) {
  const plan=createArchiveProtectionPlan({ report,inventory,revision,compatibleRevisions,cleanupOperations });
  for (const job of jobs) plan.consider(job);
  return plan.result();
}

/** Ordered reducer: only two matching bodies can survive a visit. No cross-assessment cache. */
export function createArchiveProtectionPlan({ report,inventory,revision,compatibleRevisions = [revision],cleanupOperations = null }) {
  const needed=report.bindingCount >= ARCHIVE_POLICY.pressureCount && Boolean(inventory?.entries.length);
  const candidatesSha256=needed ? candidateBatchSha256(inventory) : null;
  const available=[]; let held=false;
  return {
    needed,
    consider(job) {
      if (!needed || job.status !== 'verified' || job.manifest?.version !== 4 || !job.receipt?.verified ||
          job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash) return;
      validateReceiptForArchive(job.receipt,job.manifest,job.manifest_sha256);
      if (candidateBatchSha256(job.manifest.retention) !== candidatesSha256) return;
      held ||= job.protection?.candidates_sha256 === candidatesSha256;
      if (!job.recovery_protection_id) { available.push(job); if (available.length > 2) available.shift(); }
    },
    result() {
      if (!needed || held && !cleanupOperations || cleanupOperations?.some(op => op.candidates_sha256 === candidatesSha256 &&
          (op.status === 'completed' || op.attempt >= 3))) return { needsRecoveryCopy:false };
      if (available.length === 2) return { needsRecoveryCopy:false,pair:available,candidatesSha256 };
      const revisions=new Set([revision,...compatibleRevisions]);
      return { needsRecoveryCopy:available.length === 1 && revisions.has(available[0].revision) };
    },
  };
}

export function rollingArchives(jobs) {
  return jobs.filter(job => job.status === 'verified').slice(-2);
}
