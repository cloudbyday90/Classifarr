/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archivePolicyHash } from './archiveSchedule.mjs';
import { runArchiveAssessment } from './archiveCoordinator.mjs';
import { withOwnedCatalogSnapshot } from './ownedCatalogSnapshot.mjs';
import { catalogDue } from './catalogSchedule.mjs';
import { catalogJobRepository } from './catalogJobRepository.mjs';
import { catalogRetentionRepository } from './catalogRetentionRepository.mjs';
import { readVerifiedGatewayArchive } from './archiveFiles.mjs';
import { managedArchivePath, readArchiveReceipt, archiveStorageAvailable } from './archiveManagedFiles.mjs';
import { validateCatalogVerification } from './catalogVerificationResult.mjs';
import { gatewayError } from './errors.mjs';
import { requireCatalogCaptureFormat } from './catalogAdmission.mjs';

/** Called inside the coordinator's maintenance exclusion, never on a status read. */
export async function runCatalogAssessment({ source, maintenance, repository, configuration, paths, signal }) {
  await maintenance.query('SELECT gateway_catalog.require_lock()');
  await requireCatalogCaptureFormat(maintenance);
  const jobsRepository = catalogJobRepository(maintenance), rootsRepository = catalogRetentionRepository(maintenance);
  let jobs = await jobsRepository.list();
  const policyHash = archivePolicyHash(configuration.retentionDays);
  const history = [...jobs, ...await repository.list(), ...await rootsRepository.list()];
  if (history.some(job => job.policy_hash !== policyHash)) return { state: 'configuration_changed', purgeAuthorized: false };
  // Check the live source before acknowledgment/retirement, not only before another export.
  const identity = (await source.query('SELECT id,provider_hash FROM ollama_gateway.admission WHERE singleton')).rows[0];
  if (history.some(job => job.ledger_id !== identity?.id || job.provider_hash !== identity?.provider_hash ||
      job.provider_hash !== configuration.providerHash)) return { state: 'identity_changed', purgeAuthorized: false };
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
  let cancelled, recordedFailure;
  const outcome = await withOwnedCatalogSnapshot(configuration, async context => {
    const { semantic } = context;
    const state = catalogDue({ ...context, semantic, now: Date.parse(context.report.capturedAt), jobs, inferenceJobs, roots });
    if (state !== 'due') return { state: `catalog_${state}`, purgeAuthorized: false };
    if (!await archiveStorageAvailable(paths.catalogs, paths.receipts, [...jobs, ...inferenceJobs], [paths.archives])) return { state: 'storage_full', purgeAuthorized: false };
    signal?.throwIfAborted();
    const job = await jobsRepository.begin(context.report, context.revision, policyHash, semantic, context.compatibleRevisions);
    try { return { job, result: await context.capture({ maintenance, paths, job }) }; }
    catch (error) {
      const aborted = context.signal.aborted;
      await jobsRepository.failed(job.id, aborted ? 'cancelled' : error.code === 'gateway_archive_source_changed' ? 'source_changed' : 'export_failed');
      const result = { state: aborted ? 'catalog_cancelled' : 'catalog_export_failed', archiveId: job.id, purgeAuthorized: false };
      if (aborted) cancelled = result;
      recordedFailure = { error, result };
      return result;
    }
  }, signal, [...jobs, ...inferenceJobs].map(job => job.revision)).catch(error => {
    if (cancelled && error.code === 'gateway_archive_cancelled') return cancelled;
    if (recordedFailure?.error === error) return recordedFailure.result;
    throw error;
  });
  if (!outcome.job) return outcome;
  // An ambiguous publication stays exporting; restart never guesses that it is retryable.
  await jobsRepository.published(outcome.job.id, outcome.result);
  return { state: 'awaiting_catalog_verification', archiveId: outcome.job.id, purgeAuthorized: false };
}
