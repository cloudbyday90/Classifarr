# Recovery-to-completion outcome

## Delivered behavior

The [design](ingestion-recovery-progress-design.md) is implemented in small ES
modules. A reviewed recovery now has an explicit link from its audit receipt to
owned import attempts and committed metadata verification. History reports
requested, importing, backfilling, completed, waiting or an actionable blocker.

Import and metadata are the completion contract selected by the operator.
Optional embedding, RAG and AI evaluation tasks do not hold recovery open.
Enqueue completion, elapsed time, a restarted container or a successful recovery
confirmation alone cannot produce a completed result.

The existing refill path admits one due verification, with a persisted 60-second
cooldown, nonblocking library ownership, 250-ms lock timeout and three-second
statement timeout. No new timer, provider call, deployment setting or service is
introduced. Unavailable verification leaves normal refill operational.

Source changes and later scans supersede unfinished recovery; disabled settings
pause it without modifying those settings. Completed history remains evidence
at its recorded timestamp. Audit retention removes dependent progress, not media.

The existing administrator/actor/library-scoped history endpoint adds an
allowlisted `progress` object: `stage`, `reason`, `importedAt`, `checkedAt`,
`verifiedAt` and optional `metadata` counts (`total`, `ready`, `pending`, `blocked`).
Older unlinked receipts return `not_tracked`; no legacy ancestry is invented.
The client uses the existing named history API function, without direct HTTP calls.

## Validation

- Targeted PostgreSQL integration: **106 tests across four suites passed**.
  Includes Plex/Jellyfin/Emby retries, restart/readback, metadata evidence versus
  queue status, deferred and failed metadata, optional AI exclusion, two recovery
  requests, later scans, source changes, disabled/archive pauses, owner contention,
  concurrent verification, empty captures, unavailable/rejected capture evidence,
  cooldown after failed verification, audit retention and transaction rollback.
- Browser: **three tests passed**, including keyboard confirmation, lost-response
  reload without another write, partial-to-completed metadata display and mobile
  overflow. The 390-pixel screenshot was visually inspected.
- Full frontend coverage: **5,899 tests in 415 files passed**. Statements 86.23%,
  branches 78.92%, functions 85.63%, lines 88.09%.
- Clean full backend rerun: **49,304 passed, one existing skip, 1,612 suites
  passed**. The earlier coverage run found the SQL-style issue described below;
  every runtime test passed there as well. Fresh backend coverage: statements
  and lines 90.04%, branches 85.39%, functions 91.63%. The combined coverage
  ratchet passed with unchanged thresholds. The corrected code-health and
  ownership suites also passed in a 31,413-assertion focused rerun.
- Production frontend build, repository lint, both type checks, migration checks,
  ESM static-import/mock-shape checks, dependency checks, copyright and all four
  policy gates passed. Ownership review pins include the new lifecycle modules
  without changing unrelated unresolved writer classifications.
- The migration and regenerated schema were exercised in a disposable image and
  database, without attaching the live application data volume.

The new test fixture initially needed explicit foreign-key cleanup; it was fixed.
The SQL-style guard identified same-line interpolation of fixed SQL fragments;
those queries were extracted into named constants with parameterized values.
Neither issue was waived or hidden by lowering validation thresholds.

## Scope and limitations

GitHub MCP and the saved GitHub CLI login both reported **zero open PRs** for
`cloudbyday90/Classifarr`; there was no random PR to implement. No PR was merged.

No release, version bump, live recovery or live deployment is included. This
feature needs an updated image but no Compose/Unraid template change. It does
not prove that unknown legacy writers stopped or bypass the existing explicit
review and stopped-worker attestation.

Metadata counts use existing operational enrichment evidence, not an accuracy
score, proof of every provider's freshness or AI readiness. Historical failures
with sufficient committed metadata do not invalidate that metadata; active
metadata tasks/retries still prevent verification. Rejected source identities
require a fresh complete capture before success can be verified.

Verification is bounded, not free: one aggregate still depends on library and
queue size. If it reaches the deadline, the operation remains unverified and the
sanitized warning is deduplicated. No large-library latency claim is made from
small correctness fixtures. Snapshot completion is not permanent readiness.

## Next high-value component

Add a **bounded recovery-blocker drilldown**: show the actual pending/failed media
items, concrete reason, next retry time and links to existing review controls.
Use a fixed-size, library-scoped page and the same metadata evidence rules so the
counts and details agree. Opening it must not reset cooldowns, retry jobs or call
providers. Pair it with a realistic library/queue query-plan benchmark before
considering incremental verification or additional indexes.

This turns “Needs attention” into a specific next action, rather than adding
another summary or weakening completion requirements.
