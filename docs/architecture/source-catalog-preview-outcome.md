# Source layout preview outcome

## Implemented — 2026-10-10

The existing diagnostic CLI now accepts `--scope-preview`. Small ESM modules
capture bounded episode membership, normalize Plex/Jellyfin/Emby responses,
compare typed catalog season structure and discard observed source/configuration
drift. No mapping, source metadata, inventory, ownership or retry state is changed.
Every report explicitly says `canApply: false`, `verification: layout_only` and
`orderVerified: false`. This is live structural evidence, not a completed mapping
UI, identity approval or proof of whole-series possession.

The recovery-change skill drove bounded reads, failure/cancellation tests and the
separation between diagnostic evidence and authority to recover. The dependency
skill kept the unrelated PR trial isolated. See the separate
[design, verified sources, tradeoffs and next stack](source-catalog-preview-design.md).

## Current unresolved items

Unraid was inspected read-only and its diagnostic list refreshed at 11:06:18
Eastern on 2026-10-10: twelve unresolved items, ten source-review and two waiting
for retry. All ten active libraries have complete recent captures. No Retry,
Dismiss, scan, source rematch or recovery action was taken. The legacy failed
classification remains untouched. Local's previous eleven-observation result
must not be substituted for production evidence.

Plex artwork/descriptions do not answer the independent catalog-scope question.
The new preview reports season-count bounds without interpreting them as episode
identity, actual catalog episode numbering, or possession. It preserves source
grouping and all IDs. Labels were tightened after live evaluation to avoid
implying episode-by-episode verification from series-level season counts.
The first rebuilt-image preview rejected all eleven layouts. A bounded read-only
shape probe showed Plex grandchildren include the exact series parent key but
omit the library ID on both the child and container. Corrected the adapter to
derive library membership through its already-verified parent series, while
still rejecting a wrong series key or an explicitly conflicting child library.
Updated the real HTTP fixture to match this response shape. No identifiers or
raw response bodies from that probe are retained in this document.
The final rebuilt-image run completed with reference
`1f309d9a-a8e6-4b73-914a-f859a1a936b0`: all eleven selected local observations
were inspected, containing 49 source seasons and 834 source episodes. Fourteen
catalog-candidate comparisons produced four `within_season_count_bounds`, three
`equal_season_count_bounds` and seven `outside_season_count_bounds` results.
These are candidate comparisons, not fourteen items or seven proven wrong IDs.
Equal bounds are not episode identity, verified ordering or permission to apply
a mapping. No unresolved item was repaired by this preview.

## Independent PR #556

Applied the exact reviewed head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`:
server `@types/node` 24.19.2 → 26.6.4, `undici-types` 7.24.6 → 8.9.0.
Registry integrity matched; neither package declared install scripts. Both
scripts-disabled and reviewed installs passed, the full dependency tree was
valid, and npm audit reported zero advisories including development dependencies.

The server typecheck reproduced Discord/Undici `BodyInit`/`FormData` incompatibility.
The Node 24 baseline rejected Node 26 declarations (39/40 tooling checks passed).
Reverted the exact manifest and lockfile edits, reinstalled the original graph,
and verified server typechecking plus all 40 tooling checks. No dependency change
is retained and the PR remains unmerged. Express 5.3.0 and Knip 6.41.0 remain
separate future batches; Node 26 declarations are not a Node 24 update.

## Verification

- Focused runs passed existing replay, mapping-plan, adapter and ownership
  contracts; the post-Plex-shape run passed 261 tests across twelve suites.
- Final full backend run: 1,773 suites and 55,342 tests passed, with one Linux
  filesystem test skipped on Windows and separately exercised in the candidate
  Linux image below. The first full run had one ownership-review failure before
  the two adapter fingerprints were reviewed; the complete rerun is green.
- Twenty real PostgreSQL tests passed across two suites. Preview-specific cases
  verify read-only isolation, no transaction during HTTP, unchanged observations,
  incomplete capture exclusion and rejection after credentials/enablement drift.
- Real compressed HTTP fixtures verify adapter normalization, wrong membership,
  pagination rejection, combined-episode refusal, redirect refusal, decoded byte
  limits and cancellation that closes the socket without another request.
  Live evaluation used Plex; Jellyfin/Emby normalization was verified through the
  shared adapter's HTTP fixtures, not live Jellyfin/Emby installations.
- Final scoped coverage: 100% statements/functions/lines, 95.79% branches across
  four new modules (75 tests), including deadline and multi-library cases.
- Both workspace typechecks, server lint, ESM checks, Markdown lint and CI preflight passed.
  One initial lint failure in a test Promise executor was fixed without changing
  assertions. No test timeout, ownership classification or coverage baseline was
  weakened. The combined coverage ratchet passed using both fresh full reports.
- The complete frontend rerun passed 449 files and 6,543 tests, with no skips;
  its test-project configuration contract also passed. An initial run overlapping
  the image build exceeded the unchanged 10-second ESLint setup-hook deadline
  (6,522 passed, 21 skipped). The complete rerun passed without changing assertions,
  timeouts, dependencies or test selection. This does not prove a root cause for
  the transient setup delay.

The ownership gate correctly required re-review of both edited adapter sources.
Reviewed complete adapters and the new delegated read path: no database write,
refresh/scan or routing operation was added. Updated only their source digests;
analysis classifications, ingestion checks and unresolved writer debt are unchanged.

## Local image and schema evaluation

The final no-cache local Compose build used clean runtime source
`807979b31e7850bc017defdceeb4e125aa49566c`. Its Docker image ID is
`sha256:08419a88c32223d1c2a6f5216c7c3c1f18a745863a56eca47868e600d5364a70`.
This identifies a local image, not a published registry manifest or a release.
Final outcome documentation is committed separately from the tested runtime.

A checksum-verified, readable 76,806,437-byte PostgreSQL backup and rollback tag
were retained privately before replacement. The original image was
`sha256:e10eab954d311ccbae48befe177c931ed41023ea1865c59817ab557e0b33235f`.
Backup readability is not a restore rehearsal.

The final replacement started at `2026-10-10T15:30:03.344509439Z`: healthy,
HTTP 200, zero restarts, no OOM, UID/GID `1000:1000`, read-only root filesystem
and no-new-privileges retained. Early usage was 861.6 MiB of the unchanged 2 GiB
limit. This is a startup observation, not a sustained memory study or a memory fix.
A bounded read-only query found no error-log rows since this final startup.

The Windows-skipped Linux directory-fsync/exclusive-copy behavior passed against
the exact candidate image's actual module, using synthetic temporary files,
network disabled, non-root execution, read-only root and bounded resources.
Source/destination digests matched, the source stayed unchanged, and a repeated
exclusive copy failed with `EEXIST`. The disposable container was removed and
its absence verified.

The isolated post-build schema dump passed against this exact image, through
`20261010_140000_classification_metadata_failure_context.sql`, including 22 seed
migrations. The tracked snapshot is unchanged. Disposable container
`classifarr-schema-check-fd9306b5-5ed5-400c-a9cf-156ebcad421e` and its generated
data directory were removed; both absences were independently verified. The
snapshot was not generated from the live database. No production deployment,
release, version bump or shared Plex/Ollama modification was performed.

## Next recommendation

Establish independent episode identity and order evidence, then add authenticated
mapping review with source/configuration revisions and expiry. Durable scoped
edges, revocation and scope-aware consumers must land together before guarded
backfill. A numbering/count match alone must never select one conflicting ID,
claim whole-series ownership, replay a failed task or silently split source groups.
