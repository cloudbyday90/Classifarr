/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archivePolicyHash } from './archiveSchedule.mjs';
import { runArchiveAssessment } from './archiveCoordinator.mjs';
import { withOnlineArchiveSnapshot } from './onlineArchive.mjs';
import { captureCatalogContent } from './catalogContent.mjs';
import { catalogDue, catalogSemanticRevision } from './catalogSchedule.mjs';
import { catalogJobRepository } from './catalogJobRepository.mjs';
import { catalogRetentionRepository } from './catalogRetentionRepository.mjs';
import { captureScheduledCatalog } from './catalogCapture.mjs';
import { readVerifiedGatewayArchive } from './archiveFiles.mjs';
import { managedArchivePath, readArchiveReceipt, archiveStorageAvailable } from './archiveManagedFiles.mjs';
import { validateCatalogVerification } from './catalogVerificationResult.mjs';
import { gatewayError } from './errors.mjs';

/** Called inside the coordinator's maintenance exclusion, never on a status read. */
export async function runCatalogAssessment({ source, maintenance, repository, configuration, paths, signal }) {
  await maintenance.query('SELECT gateway_catalog.require_lock()');
  const jobsRepository = catalogJobRepository(maintenance), rootsRepository = catalogRetentionRepository(maintenance);
  let jobs = await jobsRepository.list();
  const policyHash = archivePolicyHash(configuration.retentionDays);
  if (jobs.some(job => job.policy_hash !== policyHash)) return { state: 'configuration_changed', purgeAuthorized: false };
  if (jobs.some(job => ['exporting', 'interrupted'].includes(job.status))) return { state: 'catalog_interrupted', purgeAuthorized: false };
  const pending = jobs.find(job => job.status === 'awaiting_verification');
  if (pending) {
    const checked = await readVerifiedGatewayArchive(managedArchivePath(paths.catalogs, pending.id), signal);
    if (checked.manifestSha256 !== pending.manifest_sha256) throw gatewayError('gateway_catalog_job_fence');
    const receipt = await readArchiveReceipt(paths.receipts, pending.id, validateCatalogVerification);
    if (!receipt) return { state: 'awaiting_catalog_verification', archiveId: pending.id, purgeAuthorized: false };
    if (receipt.archiveId !== pending.id || receipt.manifestSha256 !== pending.manifest_sha256 || receipt.dumpSha256 !== checked.manifest.dump.sha256) {
      throw gatewayError('gateway_catalog_verification_invalid');
    }
    if (!receipt.rowsRestored || !receipt.dependenciesAvailable) await jobsRepository.failed(pending.id, 'verification_failed');
    else {
      await repository.catalogRetention.retain(paths, pending.id, receipt, signal);
      signal?.throwIfAborted();
      await jobsRepository.verified(pending.id, receipt);
    }
    jobs = await jobsRepository.list();
  }
  await repository.catalogRetention.rotate(paths, signal);
  const pins = (await maintenance.query(`SELECT DISTINCT d.archive_id FROM gateway_catalog.dependency d
    JOIN gateway_catalog.snapshot s ON s.id=d.snapshot_id WHERE s.status<>'retired' LIMIT 10001`)).rows;
  if (pins.length > 10000) throw gatewayError('gateway_catalog_size_limit');
  const inference = await runArchiveAssessment({ source, repository, configuration, parent: paths.archives, receipts: paths.receipts, signal,
    catalog: { jobs, parent: paths.catalogs, pinned: new Set(pins.map(row => row.archive_id)) } });
  if (!['unchanged', 'not_due', 'attempts_exhausted', 'cooldown', 'empty'].includes(inference.state)) return inference;
  const inferenceJobs = await repository.list(), roots = await rootsRepository.list();
  if ([...jobs, ...inferenceJobs].some(job => job.policy_hash !== policyHash)) return { state: 'configuration_changed', purgeAuthorized: false };
  const snapshot = await withOnlineArchiveSnapshot(source, configuration, async value => ({ ...value,
    semantic: catalogSemanticRevision(await captureCatalogContent(source, signal, { bytes: 0 })),
    now: Date.parse(value.report.capturedAt) }), signal, [...jobs, ...inferenceJobs].map(job => job.revision));
  const state = catalogDue({ ...snapshot, jobs, inferenceJobs, roots });
  if (state !== 'due') return { state: `catalog_${state}`, purgeAuthorized: false };
  if (!await archiveStorageAvailable(paths.catalogs, paths.receipts, [...jobs, ...inferenceJobs], [paths.archives])) return { state: 'storage_full', purgeAuthorized: false };
  signal?.throwIfAborted();
  const job = await jobsRepository.begin(snapshot.report, snapshot.revision, policyHash, snapshot.semantic, snapshot.compatibleRevisions);
  let result;
  try { result = await captureScheduledCatalog({ source, maintenance, configuration, paths, job, signal }); }
  catch (error) {
    await jobsRepository.failed(job.id, signal?.aborted ? 'cancelled' : error.code === 'gateway_archive_source_changed' ? 'source_changed' : 'export_failed');
    return { state: signal?.aborted ? 'catalog_cancelled' : 'catalog_export_failed', archiveId: job.id, purgeAuthorized: false };
  }
  // An ambiguous publication stays exporting; restart never guesses that it is retryable.
  await jobsRepository.published(job.id, result);
  return { state: 'awaiting_catalog_verification', archiveId: job.id, purgeAuthorized: false };
}
