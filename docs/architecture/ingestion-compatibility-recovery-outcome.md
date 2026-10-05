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

Final test totals, rebuilt image identity, and local recovery observations will be
added after the no-cache rebuild and evaluation.

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

Ship the compatibility recovery with existing templates, subject to exact-image
validation. Preserve the full import/metadata completion rule. Next, finish
separate runtime/maintenance database identities for protection against a
privileged writer deliberately bypassing the compatibility protocol; that is a
stronger guarantee than this fix provides.
