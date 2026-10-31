# Local Classifarr artifact maintenance outcome

Date: 2026-10-31. Status: scoped cleanup completed and verified; concurrent Docker
changes are recorded separately below.
See the separate [design, research and tradeoffs](local-artifact-maintenance-design.md).

The user confirmed local Classifarr cleanup only, preserving all recovery assets,
shared cache, volumes, worktrees, tools and current evidence. Duskue, Harmoniarr
and Unraid are outside the mutation scope. No release or deployment is requested.

## Cleanup outcome

Removed 4,916 reviewed top-level outputs: 485 generated directories and 4,431 old
validation/result files, totaling 1,818,997,918 bytes (1.69 GiB). Six directories
whose timestamp evidence could not be revalidated were excluded and remain.
All 157 inventoried backup/archive files retain their original sizes and precise
modification times: 10,765,621,702 bytes (10.03 GiB), including the 136 database
dumps. Tools, model weights, current evidence and registered worktrees remain.
Source and application data were not cleanup targets.

All sixty reviewed development-image IDs are absent. Their pre-cleanup logical
sizes sum to 31.64 GiB; this is not a measured physical-space saving. All 228
retained main-application image IDs outside the manifest remain, including the
rollback and reference assets. Individually addressed, non-force removals used
`--no-prune`; no global prune, container/volume removal, shared-cache pruning,
registry operation or direct Docker-store deletion was issued by this task.

The skill is versioned in `.agents/skills/classifarr-artifact-maintenance` and
installed under the same name in the user's local Codex skills directory. The
installed files match the repository source. Normal automatic discovery remains
enabled. All five agent-instruction files contain the same maintenance section.
The agent checks before disk-heavy builds and at substantial test/build handoffs;
the user does not need a housekeeping CLI. This adds no unattended timer or UI.

## Verification and lessons

Both skill installations pass the skill validator. Markdown lint passed 2,401
files with zero errors; copyright checks passed 1,834 applicable files. The five
maintenance instruction sections match; whitespace and the staged secret scan
pass. Private
receipts record exact candidates, exclusions, revalidation and final object
checks. Runtime source, schema, dependencies and UI are unchanged; application
coverage suites were not rerun for this documentation/skill-only delivery.

Two temporary helper issues were caught and corrected. PowerShell's JSON date
conversion lost the comparison's UTC/fractional context; the initial dry run
excluded every file without deletion. Explicit string-date parsing fixed that
check. A single-result PowerShell assignment then became a scalar string, so
native splatting split an image ID into characters. Docker rejected those missing
or invalid references. Explicit array typing and a native argument-contract check
corrected it; remaining exact-ID removals completed with literal argument lists.
Both lessons are recorded in the skill. No protection was bypassed to make a
removal succeed.

## Concurrent shared-Docker changes

The user was independently cleaning another project on the same Docker daemon.
During this run, unrelated images, containers and volumes also disappeared, and
the two existing local services acquired new start times. The Classifarr service
kept its full container ID and exact image `82a6025389df…`, and is healthy. This
task issued no service stop/restart/recreation commands. Image removal was paused,
current state reconciled, and the remaining manifest resumed against the current
service state; that state stayed unchanged through completion.

Final comparison also found 24 Classifarr sidecar images outside this pass's
manifest missing, including a test-baseline reference. This task issued no
removals for those IDs. Their absence is an observed out-of-scope change, not a
claim that all shared-Docker recovery assets survived or that this pass caused
or reclaimed their storage. The retained main-application rollback images and
workspace backups were separately verified. The available evidence does not
identify the caller of every shared-daemon change.

Therefore global before/after Docker usage cannot measure this pass's savings.
The final observed inventory reported 522 images / 208.7 GB and 312.4 GB of build
cache, but these are shared-daemon snapshots. No Windows VM-disk compaction or
physical Docker-space reclamation is claimed. Future housekeeping must coordinate
across projects and stop/reconcile shared-state drift rather than expanding a
project cleanup into a host-wide prune.

## Delivery and next step

GitHub MCP inventory returned no open Classifarr PRs, including Dependabot; there
was no applicable random PR or stale dependency PR to rebase. No PR was merged.
Unreleased is updated. Work remains on main, without a release or deployment.

The previously agreed next application batch is precise storage-failure handling:
recognize trusted PostgreSQL `53100` as disk-full in description and representative
refreshes, give fixed safe guidance through existing logs, and wait one hour
before retrying heavy work. Preserve completed caches, admission, cancellation,
ownership fail-stop and other retry policies; provider codes/raw messages cannot
become database evidence. Cooldowns remain process-local, with preliminary
readiness checks still permitted. Prove the path with focused and isolated
PostgreSQL tests. No new screen, endpoint, job, setting, cleanup or deployment is
part of that batch.

After storage handling, return to automatic prospective classification-evidence
collection after a separately authorized deployment, then select a demonstrated
routing defect. Local artifact cleanup does not resolve the separately observed
Unraid database ENOSPC. For further local prevention, consider a dedicated
Classifarr builder with bounded garbage collection; backup/rollback retirement
still needs its own explicit retention decision.

Follow-up: the agreed storage-handling batch is described in the separate
[design](inventory-refresh-storage-failure-design.md), with implementation,
verification and the current next item in its [outcome](inventory-refresh-storage-failure-outcome.md).
