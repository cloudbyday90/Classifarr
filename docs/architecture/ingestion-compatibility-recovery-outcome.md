# Legacy ingestion compatibility recovery outcome

Date: 2026-10-05. Branch: main. No release or PR merge.

## Change

Implemented the administrator-selected
[compatibility design](ingestion-compatibility-recovery-design.md). A transactional
database migration blocks unmodified older ingestion writers. Current connections
announce the protocol explicitly. Pre-cutover markers can then be retired by the
existing bounded library owner, with system audit evidence and tracked full import
plus metadata backfill. Current-protocol unknown writers still require review.

The recovery skill shaped the separation of marker provenance, write exclusion,
audit durability, and actual import completion. The stronger privilege-isolation
review remains unresolved; no existing security debt was relabeled as solved.

## Local evidence before replacement

- Family: 866 inventory rows, complete owner, no unfinished markers.
- Movies: 2,816 inventory rows, six legacy running markers, no owner ledger.
- Both use the local test database. The Unraid installation has a separate database
  and has not been modified. Sharing Plex is not a shared ownership conflict.

## Validation

Real PostgreSQL tests cover actual migration lock contention and rollback, an old
repeatable-read transaction attempting a late write, old-client updates/deletes/
truncate/cascade behavior, replication-mode trigger enforcement, current marker
stamping, legacy batches, source eligibility, active-owner exclusion, audit failure,
and full replay following a provider outage. Recovery history distinguishes system
actions from personal administrator confirmations. Fresh schema dump/load/dump
round-trip has zero drift on isolated PostgreSQL 18.

- Backend unit suite: 1,700 suites, 52,830 tests passed. One Windows-inapplicable
  directory-fsync test was skipped; its real Linux copy/fsync, source-preservation,
  and refusal-to-overwrite checks passed in the rebuilt image.
- Targeted PostgreSQL integration: eight suites, 208 tests passed, including
  Plex/Jellyfin/Emby movie and TV recovery. Fixed a fixture cleanup race: verify
  remaining sessions after termination instead of treating an already-exited
  session's `pg_terminate_backend(false)` result as a cleanup failure.
- Recovery-history client tests: seven passed. Server/client lint and typechecks,
  Markdown lint, ESM checks, migration/schema checks, ownership review, preflight,
  and staged-secret checks passed. The existing stronger ownership-review debt
  remains explicitly incompatible, not silently waived.

## No-cache image and local replacement

Built from clean source `fd6cf207ea863a1da8bfbe57c5b28aca813c2f31` with
`node scripts/docker-compose-smart.mjs build --no-cache --require-provenance classifarr`.
The local Docker image ID is
`sha256:a4cbb8365c992bbaebc0d4cf9e8b3e1019662204a40c3cd6ff2795afced3584a`.
Its OCI revision label matches the source; this is local build evidence, not
published registry provenance or a multi-platform release result.

After the rebuild, ran the schema dump against isolated PostgreSQL 18 from this
exact image. Loading the snapshot into another fresh database and dumping again
produced zero drift, including the compatibility migration receipt.

The exact-image embedded isolation drill passed all 12 core checks and its
standard UID 1000, custom UID 2345, and Unraid-style UID/GID 99:100 profiles.
It exercised the existing compatible queue/image workers, protected runtime,
interrupted routing, restore handoff, startup, clean restarts, and forced-host-kill
recovery. Disposable container/volume/image-alias cleanup passed; the caller's
image was retained. These Linux fixtures are not a test on an actual Unraid host.

Retained a 75,995,832-byte pre-upgrade database backup in ignored local storage.
Replaced only the local `classifarr` container without rebuilding or pulling.
It became healthy with zero restarts. The real startup applied the migration and
all 12 compatibility triggers were enabled ALWAYS. No manual marker rewrite,
ownership fabrication, configuration change, or recovery API call was used.

- At 17:04:44 UTC, Movies completed a full import: 2,315/2,315 items. All six
  legacy markers were retired in one atomic system audit record (2353).
- The verified complete scan removed 501 stale local inventory records. No media
  files were removed; the pre-upgrade database backup retains the old inventory.
- Family remained complete with 866 items and no legacy markers. It required no
  compatibility recovery audit.
- Movies' metadata enqueue handoff completed at 17:04:54 UTC. A subsequent normal
  full scan completed at 17:06:44 UTC and superseded the first recovery receipt
  with `new_scan`, as the existing lifecycle specifies.
- A read-only check at 17:06:34 UTC found 2,278 metadata-ready items, 37 pending,
  and zero failed. One source observation still had conflicting provider IDs.
  Therefore ownership/import recovery is proven, but full metadata completion is
  **not** claimed. No ownership warning recurred during these observations.
- At 17:08:42 UTC, all source observations had cleared, metadata readiness was
  2,280/2,315 with 35 pending and zero failed, and there were no legacy unfinished
  markers anywhere in this database. Health returned 200; anonymous library access
  remained 401. One skipped-source-item warning was recorded, not an ownership
  warning. The capture retains its original two rejected-item observations, so
  disappearance from the observation queue alone is not full completion evidence.

The short resource sample ranged from 763 MiB to 1.112 GiB of the 2 GiB limit
during import/backfill, with 38–40 PIDs and CPU samples of 50–151% (Docker reports
multiple cores above 100%). The process list showed the expected supervisor,
application, and PostgreSQL processes. This is not a sustained resource soak;
the unchanged local Compose still has no CPU or PID cap.
The final sample settled to 1.87% CPU, 476.3 MiB, and 37 PIDs. No persistent extra
maintenance process appeared in the process inspection.

## Random open PR trial

The current open candidates were #555 and #556; random selection chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact manifest/lockfile
changes locally: server `@types/node` 24.19.1 → 26.6.4 and `undici-types`
7.24.6 → 8.9.0. `npm ci` installed the candidate; npm audit reported zero
vulnerabilities. Dependency inventory was retained in ignored local evidence.

Baseline tooling passed 30/30; the candidate passed 29/30, failing deployed Node
24 declaration alignment. Server typechecking also failed with incompatible
Discord/Undici `BodyInit`/`File` definitions. Reversed only the trial patch and
reinstalled the baseline; tooling returned to 30/30. No dependency change is kept,
and the PR remains unmerged. This follows
[DefinitelyTyped's version alignment guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md),
checked through online search and the official registry on October 5.

## Recommendation

Keep the compatibility recovery for existing templates and preserve the full
import/metadata completion rule. The immediate follow-up is retaining useful
completion tracking when a routine same-source scan starts before metadata
finishes, including rechecking resolved source-ID evidence rather than relying
on an old rejected-item counter. Do not mark blocked identity evidence as successful.

Separately, finish runtime/maintenance database identities for protection against
a privileged writer deliberately bypassing the compatibility protocol. That is a
stronger guarantee than this fix provides. Unraid was not deployed or modified;
this behavior reaches it only when an image containing the change is installed.
