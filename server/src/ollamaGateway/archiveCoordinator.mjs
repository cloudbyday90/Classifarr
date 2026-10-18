/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveDue, archivePolicyHash,ARCHIVE_POLICY } from './archiveSchedule.mjs';
import { withOnlineArchiveSnapshot, createOnlineArchive } from './onlineArchive.mjs';
import { archiveStorageAvailable, readArchiveReceipt, checkManagedArchive, retireManagedArchive } from './archiveManagedFiles.mjs';
import { gatewayError } from './errors.mjs';
import { validateReceiptForArchive } from './archiveReceiptBinding.mjs';
import { captureRetentionInventory } from './archiveRetentionQueries.mjs';
import { rollingArchives } from './archiveProtectionPolicy.mjs';
import { reconcileArchiveProtection,planArchiveProtection } from './archiveProtectionService.mjs';

async function rotate(repository, parent, jobs, signal, pinned = new Set()) {
  const verified = jobs.filter(job => job.status === 'verified');
  const retiring = jobs.find(job => job.status === 'retiring');
  const rolling = rollingArchives(jobs);
  const selected = retiring ?? verified.find(job => !job.recovery_protection_id && !rolling.includes(job));
  if (!selected || pinned.has(selected.id)) return;
  await repository.assertNotCatalogPinned(selected.id);
  const prior=await repository.evidence(selected,signal), remaining=[];
  for (const summary of rolling.filter(job => job.id !== prior.id)) {
    const kept=await repository.evidence(summary,signal);
    await checkManagedArchive(parent,kept,signal); remaining.push(kept);
  }
  if (remaining.length < 2) throw gatewayError('gateway_archive_rotation_blocked');
  if (!remaining.some(job => job.receipt?.verified && job.receipt.preserves.includes(prior.id) &&
      job.manifest.predecessors.some(item => item.archiveId === prior.id && item.manifestSha256 === prior.manifest_sha256) &&
      job.ledger_id === prior.ledger_id && job.provider_hash === prior.provider_hash &&
      BigInt(job.manifest.report.attempts) >= BigInt(prior.manifest.report.attempts))) throw gatewayError('gateway_archive_rotation_blocked');
  if (!retiring) {
    await checkManagedArchive(parent,prior,signal);
    signal?.throwIfAborted(); await repository.retiring(prior.id);
  }
  // Recheck even on restart: an old retiring decision is not present dependency evidence.
  await repository.assertNotCatalogPinned(prior.id);
  signal?.throwIfAborted();
  await retireManagedArchive(parent,{ ...prior,status: 'retiring' },signal); await repository.retired(prior.id);
}

/** Called serially by a lock-owning service; no inference writes or provider calls. */
export async function runArchiveAssessment({ source, repository, configuration, parent, receipts, signal, catalog = null }) {
  // The legacy worker does not own the separate catalog store or its shared admission budget.
  // Do not silently admit more inference archives with incomplete storage accounting.
  if (!catalog && await repository.hasCatalogRetention()) return { state: 'catalog_retention_integration_required', purgeAuthorized: false };
  const policyHash = archivePolicyHash(configuration.retentionDays);
  let jobs = await repository.list();
  const available = async () => archiveStorageAvailable(parent, receipts, [...await repository.list(), ...(catalog?.jobs ?? [])], catalog ? [catalog.parent] : []);
  if (jobs.some(job => job.policy_hash !== policyHash)) return { state: 'configuration_changed', purgeAuthorized: false };
  const snapshot = await withOnlineArchiveSnapshot(source,configuration,async value => ({ ...value,
    inventory: value.report.bindingCount >= ARCHIVE_POLICY.pressureCount ? await captureRetentionInventory(source,value.report) : null,
    now: Date.parse(value.report.capturedAt) }),signal,jobs.map(job => job.revision));
  const { report,revision,compatibleRevisions,now } = snapshot;
  if (jobs.some(job => job.ledger_id !== report.ledgerId || job.provider_hash !== report.providerHash)) {
    return { state: 'identity_changed',purgeAuthorized: false };
  }
  const pendingSummary = jobs.find(job => job.status === 'awaiting_verification');
  if (pendingSummary) {
    const pending=await repository.evidence(pendingSummary,signal);
    await checkManagedArchive(parent,pending,signal);
    const receipt = await readArchiveReceipt(receipts,pending.id);
    if (!receipt) return { state: 'awaiting_verification', archiveId: pending.id, purgeAuthorized: false };
    validateReceiptForArchive(receipt,pending.manifest,pending.manifest_sha256);
    if (!receipt.verified) await repository.failed(pending.id,'verification_failed');
    else await repository.verified(pending.id,receipt);
    jobs = await repository.list();
  }
  await reconcileArchiveProtection(repository,parent,jobs,signal);
  jobs=await repository.list();
  const protection = await planArchiveProtection(repository,{ ...snapshot,jobs,cleanupOperations: await repository.cleanupOperations() },signal);
  if (protection.pair) {
    if (!await available()) return { state: 'storage_full',purgeAuthorized: false };
    for (const job of protection.pair) await checkManagedArchive(parent,job,signal);
    signal?.throwIfAborted(); await repository.protect(protection.pair,protection.candidatesSha256);
    jobs = await repository.list(); await reconcileArchiveProtection(repository,parent,jobs,signal);
  }
  await rotate(repository,parent,await repository.list(),signal,catalog?.pinned); jobs = await repository.list();
  const state = archiveDue({ report,revision,compatibleRevisions,jobs,now,needsRecoveryCopy: protection.needsRecoveryCopy,
    budgetJobs: [...jobs, ...(catalog?.jobs ?? [])] });
  if (state !== 'due') return { state, purgeAuthorized: false };
  if (!await available()) return { state: 'storage_full', purgeAuthorized: false };
  const prior = rollingArchives(jobs);
  const predecessors = [];
  for (const summary of prior) {
    const job=await repository.evidence(summary,signal);
    await checkManagedArchive(parent,job,signal);
    predecessors.push({ archiveId: job.id, manifestSha256: job.manifest_sha256, content: job.manifest.content });
  }
  signal?.throwIfAborted();
  const job = await repository.begin(report,revision,policyHash,compatibleRevisions);
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
