/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { checkManagedArchive,managedArchivePath } from './archiveManagedFiles.mjs';
import { ensureArchiveProtection } from './archiveProtectionFiles.mjs';
import { gatewayError } from './errors.mjs';
import { createArchiveProtectionPlan } from './archiveProtectionPolicy.mjs';

export async function planArchiveProtection(repository,input,signal) {
  const plan=createArchiveProtectionPlan(input);
  if (plan.needed) for (const summary of input.jobs) {
    signal?.throwIfAborted();
    if (summary.status === 'verified') plan.consider(await repository.evidence(summary,signal));
  }
  return plan.result();
}

/** Resume SQL-first protection publication, but never infer deletion or expiry from time. */
export async function reconcileArchiveProtection(repository,parent,jobs,signal) {
  const groups = new Map();
  for (const summary of jobs) {
    if (summary.status !== 'verified') continue;
    signal?.throwIfAborted();
    const job=await repository.evidence(summary,signal);
    if (job.recovery_protection_id) {
      await checkManagedArchive(parent,job,signal);
      const members = groups.get(job.recovery_protection_id) ?? [];
      members.push({ id:job.id,protection:job.protection }); groups.set(job.recovery_protection_id,members);
    }
    await ensureArchiveProtection(managedArchivePath(parent,job.id),job);
  }
  // Validate every group's membership before publishing readiness for any group.
  for (const members of groups.values()) {
    if (members.length !== 2) throw gatewayError('gateway_archive_protection_fence');
  }
  for (const [id,members] of groups) {
    signal?.throwIfAborted();
    if (!members[0].protection.ready_at) await repository.ready(id);
  }
}
