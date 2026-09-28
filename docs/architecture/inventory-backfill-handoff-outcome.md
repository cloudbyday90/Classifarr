# Durable inventory-to-backfill handoff: outcome

Date: 2026-09-28. Design: [durable handoff](inventory-backfill-handoff-design.md).

## Delivered behavior

An empty queue no longer admits background evaluation when a completed owned
library scan has not yet passed through metadata refill. The ingestion run UUID
is the durable intent, so there is no post-commit in-memory message to lose.
Existing completed runs start unacknowledged after the additive migration.

The new ESM relay uses the existing refill eligibility, metadata payload builder,
task queue and enrichment-state derivation. Each transaction processes at most
250 inventory rows; an invocation processes at most 20 pages. Jobs, item state
and page checkpoint commit together. A new run starts a new pass; row locking
prevents overlapping relay acknowledgement. Ordinary refill does not bypass an
unacknowledged owned library. Manual and scheduled refill calls share a database
session lock, including when an ordinary refill overlaps a new ingestion run.

The fresh-install schema snapshot was regenerated and checked with a disposable
container built from this worktree. Only the additive handoff columns, constraints
and migration receipt changed. The ownership review gate now pins the relay and
its refill dependencies; existing unresolved writer classifications remain
unresolved, not silently approved.

## Validation evidence

The dedicated PostgreSQL suite covers all three providers and both supported
media types, legacy adoption, bounded multi-page progress, fairness, rollback
after queue insertion, concurrent relays, held row locks, generation replacement,
disabled/unfinished libraries, optional-provider waits, empty libraries and
migration reapplication. The real Jellyfin process test additionally kills the
ingestion process after scan commit with zero queue rows and confirms that
learning remains deferred before the normal queue facade performs backfill.

- Backend unit coverage: 1,510 suites and 45,468 tests passed; statement coverage
  90.31%, branch coverage 84.75%.
- Frontend coverage: 401 files and 5,648 tests passed; statement coverage 85.95%,
  branch coverage 78.45%.
- Coverage ratchet passed without changing its baseline.
- PostgreSQL integration: 189 suites and 2,180 tests passed; one existing suite/test
  remains skipped. The dedicated handoff suite contributes 16 passing cases.
- Lint, server/client type checks, migration validation, fresh schema comparison,
  copyright, dependency and ownership preflight, policy gates, ESM import/mock
  checks, Markdown lint and `git diff --check` passed.

Initial broad runs exposed fixture assumptions: helpers replaced the production
refill service, older readiness assertions expected immediate admission, and a
cooldown fixture combined identity replacement with retry timestamps that the
identity-reset trigger correctly cleared. The fixtures now exercise the production
handoff and respect the trigger. The final full runs passed after those corrections;
no coverage baseline or safety gate was weakened to obtain a pass.

## Operational limits and next work

- This is durable enqueue coverage, not a claim that every metadata provider
  succeeded, every item has an authoritative identity, or routing is accurate.
- Future-due optional-provider retries retain their existing eligibility rules.
  A failed transaction remains pending for the existing scheduled refill retry.
- Mixed older application binaries and noncooperating external writers are not
  certified by cooperative row/advisory locks. Deploy with normal upgrade controls.
- The crash test uses real ingestion child processes and PostgreSQL, not a full
  released application/container restart. Schema startup checks use isolated
  empty databases, not the user's persistent installation.
- No release, tag, PR merge, live container restart or live data modification was
  performed. [PR 550](pr-550-runtime-local-adoption.md) was adopted locally.

Next recommendation: extend the existing runtime-installation acceptance harness
with a packaged-image fresh-install and previous-release upgrade drill that
exercises the real startup scheduler through ingestion, backfill and profile
refresh without manually invoking each service. Its acceptance condition should
be measured progress and safe deferral, not simply a healthy HTTP response.
