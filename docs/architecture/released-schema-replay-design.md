# Released-schema replay gate — design

## Problem and decision

The fresh-install snapshot can claim a migration in its ledger even when its
table definition predates a later edit to that same migration. Re-dumping a
database booted from that snapshot cannot detect the missing change. The
previous profile-worker work exposed exactly this failure mode. The release
rehearsal tested profile behavior, but did not compare the entire schema.

Run a second, read-only CI verification command against two disposable
PostgreSQL databases in one Testcontainers instance:

1. Read the last published release's snapshot from the exact pinned Git tag
   and commit. Reject a missing or moved tag.
2. Load that snapshot into an empty `classifarr_replay_release` database and
   apply every post-release migration with the production migration runner.
3. Load the checked-in current snapshot into a separate empty
   `classifarr_replay_current` database. Require its migration ledger to be
   complete without replaying more migrations.
4. Compare the two PostgreSQL `pg_dump --schema-only` catalogs and fail on
   structural disagreement. Never accept a live connection URL or data mount.

Only known presentation differences are normalized: PostgreSQL dump version
banners, `\\restrict` tokens, object output ordering, equivalent text-literal
array casts, and inherited names on otherwise identical `NOT NULL` columns.
Column types, defaults, constraints, indexes, views, triggers, functions,
extensions, and migration ledger completeness remain in scope. The gate does
not claim to compare seed rows or validate the correctness of media routing.
The existing snapshot-drift check remains separate and still verifies that a
fresh installation of the current application produces the checked-in file.

## Alternatives and tradeoffs

| Approach | Benefit | Cost / reason not selected |
| --- | --- | --- |
| Re-dump current snapshot only | Fast and already in CI | A stale migration ledger can conceal missing DDL. |
| Replay every migration from an empty database | Broad history coverage | Does not model the upgrade path from the last published release and is slower. |
| Pinned release replay plus catalog comparison (selected) | Exercises the relevant upgrade path and detects structural divergence | Needs a full-tag checkout and an additional short-lived PostgreSQL container. |
| Connect to an operator's database | Could reveal live upgrade problems | Exposes private data and risks mutation; prohibited by this gate. |

Final stack: immutable release tag/commit → isolated release snapshot → current
migration runner → current fresh snapshot in a second isolated database →
complete ledger check → normalized full-catalog comparison → CI failure on
divergence. Keep the independent fresh-snapshot drift check and behavioral
backfill rehearsal. No release or routing change is part of this work.

## Safety and source basis

The command accepts no database credentials, URL, or dump path from callers;
it creates its own random ephemeral password and closes both pools and the
container in `finally`. Database names are fixed and checked empty before
writing. Catalog comparisons never upload table rows. The pinned release
commit must be updated deliberately when a new release is published.

Official sources verified in September 2026:

- [PostgreSQL 18 `pg_dump`](https://www.postgresql.org/docs/18/app-pgdump.html)
  documents `--schema-only` as object definitions without data and supports
  owner/privilege suppression for a portable comparison.
- [GitHub `actions/checkout` README](https://github.com/actions/checkout/blob/main/README.md)
  documents that the default fetch depth is one and that `fetch-depth: 0`
  fetches tag history. CI disables persisted checkout credentials.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) applies to user interfaces,
  not this headless CI gate. No new UI is introduced; a future Command Center
  status for this gate should use a programmatically determinable status
  message and avoid interrupting the operator.
