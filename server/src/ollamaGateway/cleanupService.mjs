/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveJobRepository } from './archiveJobRepository.mjs';
import { cleanupRepository } from './cleanupRepository.mjs';
import { archivePolicyHash } from './archiveSchedule.mjs';
import { rollingArchives } from './archiveProtectionPolicy.mjs';
import { checkManagedArchive,managedArchivePath,archiveStorageAvailable,readArchiveReceipt } from './archiveManagedFiles.mjs';
import { ensureArchiveProtection } from './archiveProtectionFiles.mjs';
import { gatewayError } from './errors.mjs';
import { isDeepStrictEqual } from 'node:util';

/** Caller owns cleanup session lock and maintenance exclusion. Never call inside a transaction. */
export async function runCleanupAssessment({ client,configuration,signal }) {
  const repository = cleanupRepository(client), operations = await repository.list();
  // The session lock proves no prior worker statement is still running. Observe commit before confirming it.
  for (const op of operations.filter(op => op.status === 'admitted' || op.status === 'completed' && !op.confirmed_at)) {
    signal?.throwIfAborted(); await repository.reconcile(op.id);
  }
  const jobs = await archiveJobRepository(client).list(), pair = rollingArchives(jobs), policyHash = archivePolicyHash(configuration.retentionDays);
  if (jobs.some(job => job.provider_hash !== configuration.providerHash || job.policy_hash !== policyHash)) {
    return { state: 'configuration_changed' };
  }
  if (pair.length !== 2 || !pair[0].protection?.ready_at || pair[0].recovery_protection_id !== pair[1].recovery_protection_id ||
      jobs.some(job => ['exporting','awaiting_verification','interrupted','retiring'].includes(job.status) ||
        job.status === 'verified' && (!job.recovery_protection_id || !job.protection?.ready_at))) return { state: 'awaiting_protection' };
  const hold = pair[0].protection;
  if (operations.some(op => op.candidates_sha256 === hold.candidates_sha256 && op.status === 'completed')) return { state: 'unchanged' };
  for (const job of jobs.filter(job => job.status === 'verified')) {
    signal?.throwIfAborted();
    await checkManagedArchive(configuration.archives,job,signal);
    if (!isDeepStrictEqual(await readArchiveReceipt(configuration.receipts,job.id),job.receipt)) {
      throw gatewayError('gateway_archive_receipt_invalid');
    }
    // Ready groups may only read/fsync their existing marker; never repair a missing one here.
    await ensureArchiveProtection(managedArchivePath(configuration.archives,job.id),job);
  }
  if (!await archiveStorageAvailable(configuration.archives,configuration.receipts,jobs)) return { state: 'storage_full' };
  signal?.throwIfAborted();
  const op = await repository.admit(hold,policyHash);
  signal?.throwIfAborted();
  const result = await repository.execute(op);
  if (result.status !== 'completed') throw gatewayError('gateway_cleanup_operation_fence');
  // This is a separate autocommit statement, deliberately after the deletion transaction's acknowledgement.
  const confirmed = await repository.reconcile(result.id);
  return { state: 'completed',operationId: confirmed.id,deletedBindings: confirmed.deleted_bindings,
    confirmedAt: confirmed.confirmed_at,minimumRecoveryDays: 30 };
}
