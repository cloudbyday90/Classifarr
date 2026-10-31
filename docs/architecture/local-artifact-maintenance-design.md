# Local Classifarr artifact maintenance design

Date: 2026-10-31. Scope: this development workspace and local Docker Desktop.
The user corrected an unrelated project name to Classifarr and confirmed a
conservative cleanup that preserves all recovery assets. No Unraid cleanup,
restart, deployment or release is included.

## Evidence and decision

The initial local Docker inventory reported 775 images / 376.4 GB and 6,699 build
cache records / 316.6 GB. These categories share storage; their sizes must not be
added together. Eighteen containers included active Classifarr and Harmoniarr,
an unrelated stopped application and fifteen old capacity fixtures. Container
and volume removal are outside this pass.

The workspace `.tmp` contained about 15 GiB. Of that, 136 PostgreSQL dumps alone
used 9.26 GiB. They are recovery assets, not automatically disposable cache.
The reviewed old generated outputs comprise 491 directories and 4,431 files,
about 1.715 GiB before fresh validation. Toolchains, models, registered worktrees,
source snapshots, archives, state markers and current evidence are excluded.

Sixty old unused development images have exact Classifarr title/source metadata
and no container reference. Their logical sizes sum to 31.64 GiB, which is not a
prediction of disk savings. The initial 61-candidate list included `classifarr:test`;
executable/CI reference review correctly protected it. Four later-discovered
fixture images remain outside the confirmed first-pass list.

Use an automatically discoverable, repository-owned AI skill and a matching local
installation. The agent inventories before disk-heavy work and at substantial
build/test handoffs, then executes verified cleanup within the agreed policy.
This is part of the existing engineering workflow, not an unattended service or
a new operator workflow. No application screen, button, Docker socket mount,
scheduler, dependency or permanent cleanup framework is needed.

## Eligibility and lifecycle

Generated validation outputs become candidates after fourteen days; unused
Classifarr development/test images after seven days. Purpose and ownership must
also be verified. Preserve all backup/rollback and release/reference assets,
every container-referenced image, current evidence, tools/models and worktrees.
Unknown provenance remains an exclusion. No work is necessary when nothing is
eligible or the task is read-only.

Create an exact private manifest, then recheck path boundaries, reparse points,
size/time metadata, image identity/tags and complete container references before
each removal. Use literal paths and individually addressed Docker removals without
force. A changed, locked or conflicting resource is skipped; an uncertain Docker
result is inspected before any retry. Never retry deletion against a reused name
or reset a protection to make progress. No active build may share a candidate.

Removal is irreversible; the keep set is the recovery boundary. Do not delete
appdata, databases, WAL, backups, source, volumes or arbitrary Docker internals.
No rollback retirement follows from an image merely being unused. Shared cache
needs separately established ownership or an agreed builder-wide policy. A
familiar command description does not prove that a shared cache record belongs
only to this project. Preserve the local context and service identity throughout.

On interruption, keep the receipt and reconcile the exact manifest with current
state. Do not rerun a broad selection blindly. Completion means exact removals
are verified, protected resources and service identities survive, fresh usage is
recorded, and remaining ambiguity is reported. Free space inside Docker's VM and
Windows disk-file allocation are separate observations.

## Research and tradeoffs

Official sources discovered and read through MCP on 2026-10-31:

- [Docker pruning](https://docs.docker.com/engine/manage-resources/pruning/)
  distinguishes images, containers, volumes and build cache. Our inference is to
  use exact project-owned candidates instead of a daemon-wide prune.
- [Docker image removal](https://docs.docker.com/reference/cli/docker/image/rm/)
  explains tag versus image removal and force behavior. Preserve Docker's normal
  conflict checks and verify tags against full IDs.
- [Docker storage reporting](https://docs.docker.com/reference/cli/docker/system/df/)
  distinguishes shared and unique image storage. Report actual fresh totals
  rather than promising the sum of candidate logical sizes.
- [BuildKit garbage collection](https://docs.docker.com/build/cache/garbage-collection/)
  supports age and storage policies and separates shared from unshared cache.
  Shared daemon configuration changes affect other projects and are deferred.
- [Buildx pruning](https://docs.docker.com/reference/cli/docker/buildx/prune/)
  scopes work to a builder and documents exact filters. This does not make all
  records in the current shared builder Classifarr-owned.
- [Unraid Docker overview](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/)
  distinguishes persistent appdata from Docker image storage. Local Docker
  cleanup cannot be claimed to fix the separately observed Unraid database ENOSPC.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against unnecessary interruption and overly chatty announcements.
  Engineering housekeeping adds no UI; future meaningful status changes should
  use existing concise accessible status surfaces. This is not a WCAG audit.

| Approach | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Exact stale outputs and verified unused development images | Reclaims known disposable artifacts with no runtime change | Leaves ambiguous/shared storage and all recovery assets | First pass |
| Retire old backups and rollback versions | Could reclaim more space | Requires an explicit retention and recovery decision | Separate review |
| Broad Docker prune | Easy to invoke | Cross-project and recovery risk | Excluded |
| Dedicated builder with bounded GC | Clearer future cache ownership and predictable growth | Builder configuration/build workflow change | Next prevention option |
| Agent skill in the existing workflow | Reusable process, no operator CLI or UI clutter | Runs with relevant agent work, not continuously | Implement |

Recommendation stack: keep-set inventory → exact scoped cleanup → verify service
and storage state → routine agent housekeeping. Evaluate a dedicated Classifarr
builder and its bounded GC separately if shared-cache growth remains material.
Keep application storage-failure handling as the previously agreed next code batch.
