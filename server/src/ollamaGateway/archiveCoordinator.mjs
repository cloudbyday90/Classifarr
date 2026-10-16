/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveDue, archivePolicyHash } from './archiveSchedule.mjs';
import { withOnlineArchiveSnapshot, createOnlineArchive } from './onlineArchive.mjs';
import { archiveStorageAvailable, readArchiveReceipt, checkManagedArchive, retireManagedArchive } from './archiveManagedFiles.mjs';
import { gatewayError } from './errors.mjs';

async function rotate(repository, parent, jobs, signal) {
  const verified = jobs.filter(job => job.status === 'verified');
  const retiring = jobs.find(job => job.status === 'retiring');
  if (!retiring && verified.length <= 2) return;
  const prior = retiring ?? verified[0], remaining = verified.filter(job => job.id !== prior.id);
  if (remaining.length < 2) throw gatewayError('gateway_archive_rotation_blocked');
  for (const kept of remaining) await checkManagedArchive(parent,kept,signal);
  if (!remaining.some(job => job.receipt?.verified && job.receipt.preserves.includes(prior.id) &&
      job.manifest.predecessors.some(item => item.archiveId === prior.id && item.manifestSha256 === prior.manifest_sha256) &&
      job.ledger_id === prior.ledger_id && job.provider_hash === prior.provider_hash &&
      BigInt(job.manifest.report.attempts) >= BigInt(prior.manifest.report.attempts))) throw gatewayError('gateway_archive_rotation_blocked');
  if (!retiring) {
    await checkManagedArchive(parent,prior,signal);
    signal?.throwIfAborted(); await repository.retiring(prior.id);
  }
  await retireManagedArchive(parent,{ ...prior,status: 'retiring' }); await repository.retired(prior.id);
}

/** Called serially by a lock-owning service; no inference writes or provider calls. */
export async function runArchiveAssessment({ source, repository, configuration, parent, receipts, signal }) {
  const policyHash = archivePolicyHash(configuration.retentionDays);
  let jobs = await repository.list();
  if (jobs.some(job => job.policy_hash !== policyHash)) return { state: 'configuration_changed', purgeAuthorized: false };
  const { report, revision, now } = await withOnlineArchiveSnapshot(source,configuration,async value => ({ ...value,
    now: Date.parse(value.report.capturedAt) }),signal);
  if (jobs.some(job => job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash)) {
    return { state: 'identity_changed',purgeAuthorized: false };
  }
  const pending = jobs.find(job => job.status === 'awaiting_verification');
  if (pending) {
    await checkManagedArchive(parent,pending,signal);
    const receipt = await readArchiveReceipt(receipts,pending.id);
    if (!receipt) return { state: 'awaiting_verification', archiveId: pending.id, purgeAuthorized: false };
    if (receipt.archiveId !== pending.id || receipt.manifestSha256 !== pending.manifest_sha256 ||
        receipt.dumpSha256 !== pending.manifest.dump.sha256 ||
        receipt.preserves.some(id => !pending.manifest.predecessors.some(prior => prior.archiveId === id))) throw gatewayError('gateway_archive_receipt_invalid');
    if (!receipt.verified) await repository.failed(pending.id,'verification_failed');
    else await repository.verified(pending.id,receipt);
    jobs = await repository.list();
  }
  await rotate(repository,parent,jobs,signal); jobs = await repository.list();
  const state = archiveDue({ report,revision,jobs,now });
  if (state !== 'due') return { state, purgeAuthorized: false };
  if (!await archiveStorageAvailable(parent,receipts,jobs)) return { state: 'storage_full', purgeAuthorized: false };
  const prior = jobs.filter(job => job.status === 'verified');
  const predecessors = [];
  for (const job of prior) {
    await checkManagedArchive(parent,job,signal);
    predecessors.push({ archiveId: job.id, manifestSha256: job.manifest_sha256, content: job.manifest.content });
  }
  signal?.throwIfAborted();
  const job = await repository.begin(report,revision,policyHash);
  let result;
  try { result = await createOnlineArchive(source,configuration,parent,job,predecessors,signal); }
  catch (error) {
    // Dump helper waits for child close before returning; an abrupt process death leaves exporting, never a guessed retry.
    await repository.failed(job.id,signal?.aborted ? 'cancelled' : error.code === 'gateway_archive_source_changed' ? 'source_changed' : 'export_failed');
    return { state: signal?.aborted ? 'cancelled' : 'export_failed', archiveId: job.id, purgeAuthorized: false };
  }
  // A failed/ambiguous publication write remains exporting and is blocked on restart.
  await repository.published(job.id,result);
  return { state: 'awaiting_verification', archiveId: job.id, purgeAuthorized: false };
}
