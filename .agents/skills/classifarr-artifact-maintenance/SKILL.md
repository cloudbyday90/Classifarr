---
name: classifarr-artifact-maintenance
description: Maintain Classifarr's local development artifacts after substantial test/build work or when investigating disk growth. Inventory and remove verified stale generated files and unused Classifarr images while preserving recovery assets. Not application-data retention, registry deletion, or maintenance of other projects.
---

# Classifarr local artifact maintenance

Keep local development storage bounded without adding an application page,
Docker socket access, or an operator CLI requirement. The agent performs this
work during relevant repository tasks; a skill is not an unattended timer.

## Routine

Before disk-heavy builds and at the handoff of substantial test/build work,
inspect workspace and Docker usage. Reuse a recent inventory if nothing changed.
Routine cleanup within the user's agreed policy does not need repeated approval.
If the task is read-only, inventory only. A cleanup request does not authorize
deployments, service restarts, registry changes or changes to other applications.

1. Verify the repository root, current Git changes/worktrees, local host and
   Docker context/daemon. Explicitly pin the same context for reads and removals.
   Enumerate **all** containers, including stopped ones. Do not emit environments,
   raw application logs or credentials.
2. Check existing execution helpers before creating a temporary one. Inventory
   `.tmp` by size and newest descendant modification time without following
   symlinks/reparse points. Record Docker image IDs, tags, creation time,
   Classifarr source/title labels, container references and protected references.
3. Build an explicit candidate manifest. Default local policy:
   - Generated validation logs, test-result JSON, coverage and disposable test
     outputs: older than fourteen days, with their purpose verified.
   - Unused Classifarr development/test images: older than seven days, with
     ownership established by exact metadata and repository provenance.
   Age alone does not prove ownership or disposability. An ambiguous artifact
   stays excluded. Treat counts and image logical sizes as estimates until
   removal and fresh measurements establish the outcome.
4. Preserve appdata, databases, WAL, dumps/backups, archives, model weights,
   toolchains, credentials, source, registered worktrees, current task evidence,
   release/reference images, rollback/pre-change images and every image used by
   any container. Check executable/CI references such as `classifarr:test`.
   An image with an unrelated tag is outside this policy. Backup/rollback
   retirement requires a separate explicit retention decision.
5. Ensure no active build/test uses the candidate; coordinate overlapping agent
   work before cleanup. Revalidate each candidate immediately before removal.
   On Windows, resolve its absolute path inside this repository's `.tmp`, reject
   the root itself and
   reparse points, and compare metadata with the reviewed manifest. Use native
   PowerShell `Remove-Item -LiteralPath`; never pipe computed paths to another
   shell. Changed, busy, inaccessible or uncertain targets are skipped and
   reported. Do not remove a Git worktree as a normal directory.
   Preserve UTC and fractional precision when comparing serialized timestamps;
   PowerShell JSON date conversion must not silently change those comparisons.
6. For images, recheck full IDs, exact tags, Classifarr ownership and all container
   references. Remove only individually addressed reviewed images/tags, without
   force, using `--no-prune` to preserve unreviewed parent images. Recheck a tag
   still points to its reviewed ID before removing it. A conflict is an exclusion,
   not a reason to bypass Docker's protection.
   Keep native-command arguments in an actual array, including the single-image
   case; PowerShell splatting a scalar string can split an ID into characters.
   Verify that argument contract before using a new cleanup helper.
7. Verify removals, protected files/images, unchanged service identities/start
   times and health, and fresh storage counts. Keep a private receipt under
   `.tmp`; document only useful aggregate results and unresolved exclusions.
   If shared Docker activity changes service state, pause and reconcile before
   resuming. Record observed external changes without inventing their cause or
   attributing all global storage changes to this cleanup.

Do not use blanket `docker system prune`, `image prune -a`, container/volume
pruning, or direct deletion under Docker's data store. Shared BuildKit cache
cannot be attributed to Classifarr by its size or a familiar Dockerfile fragment.
Leave it alone unless its exact ownership or a separate builder-wide policy is
established. Do not restart Docker, compact its VM disk, or change shared garbage
collection settings as an incidental cleanup step.

Prefer the existing builder's bounded garbage collection or a dedicated builder
for future builds when separately agreed. Reclamation inside Docker's VM does
not necessarily shrink the Windows disk file. Never sum image and build-cache
sizes as independent savings: layers can overlap.

For researched tradeoffs and the first verified cleanup, read the repository's
`docs/architecture/local-artifact-maintenance-design.md` and separate outcome.
Use official sources discovered through available search tools when Docker or
host behavior needs verification. Keep the process agent-operated and the UI
quiet; do not ask the user to paste housekeeping commands.
