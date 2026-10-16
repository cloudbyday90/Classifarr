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
  if (report.bindingCount < ARCHIVE_POLICY.pressureCount || !inventory?.entries.length) return { needsRecoveryCopy: false };
  const candidatesSha256 = candidateBatchSha256(inventory);
  const matching = jobs.filter(job => {
    if (job.status !== 'verified' || job.manifest?.version !== 4 || !job.receipt?.verified ||
        job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash) return false;
    validateReceiptForArchive(job.receipt,job.manifest,job.manifest_sha256);
    return candidateBatchSha256(job.manifest.retention) === candidatesSha256;
  });
  const held = matching.some(job => job.protection?.candidates_sha256 === candidatesSha256);
  if (held && !cleanupOperations) return { needsRecoveryCopy: false };
  if (cleanupOperations?.some(op => op.candidates_sha256 === candidatesSha256 &&
      (op.status === 'completed' || op.attempt >= 3))) return { needsRecoveryCopy: false };
  const available = matching.filter(job => !job.recovery_protection_id);
  if (available.length >= 2) return { needsRecoveryCopy: false,pair: available.slice(-2),candidatesSha256 };
  const revisions = new Set([revision,...compatibleRevisions]);
  return { needsRecoveryCopy: available.length === 1 && revisions.has(available[0].revision) };
}

export function rollingArchives(jobs) {
  return jobs.filter(job => job.status === 'verified').slice(-2);
}
