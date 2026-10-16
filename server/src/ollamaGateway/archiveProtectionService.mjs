/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { checkManagedArchive,managedArchivePath } from './archiveManagedFiles.mjs';
import { ensureArchiveProtection } from './archiveProtectionFiles.mjs';
import { gatewayError } from './errors.mjs';

/** Resume SQL-first protection publication, but never infer deletion or expiry from time. */
export async function reconcileArchiveProtection(repository,parent,jobs,signal) {
  const groups = new Map();
  for (const job of jobs.filter(job => job.status === 'verified')) {
    signal?.throwIfAborted();
    if (job.recovery_protection_id) {
      await checkManagedArchive(parent,job,signal);
      const members = groups.get(job.recovery_protection_id) ?? [];
      members.push(job); groups.set(job.recovery_protection_id,members);
    }
    await ensureArchiveProtection(managedArchivePath(parent,job.id),job);
  }
  for (const members of groups.values()) {
    if (members.length !== 2) throw gatewayError('gateway_archive_protection_fence');
    signal?.throwIfAborted();
    if (!members[0].protection.ready_at) await repository.ready(members[0].recovery_protection_id);
  }
}
