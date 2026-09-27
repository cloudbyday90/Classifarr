# Owned source-capture lifecycle outcome

## Delivered

The [design, official sources and tradeoffs](owned-capture-lifecycle-design.md) are
implemented. Capture creation, page writes, shared recovery callbacks and completion
now require the live owner for the same library and use its leased connection. The
store no longer accepts a database adapter as its write authority. One small ESM
helper snapshots capture coordinates; recovery closures retain those coordinates
across awaits, including content analysis.

Ordinary summaries still use their existing read services. Controlled maintenance
remains available through the common ownership wrapper, including disabled-library
`local_capture` operations. That provenance label grants no bypass. This adds no
scheduler, provider calls, schema migration, endpoint, UI change or routing authority.
Imports and recovery remain serial within an owner; no parallel transaction guarantee
is introduced.

## Verification

- Focused unit run: **97 tests passed in six suites**, covering the scope, owner,
  store, sync and recovery helpers. Regressions exercise missing/wrong-library
  ownership, forged adapters, disconnected/closed owners, immutable coordinates,
  delayed callback mutation and stale capture rejection.
  Final focused ownership/audit-gate repeat: **57 tests passed in two suites**.
- Initial PostgreSQL run: **72 tests passed in six suites**. Final run: **73 tests
  passed in six suites**, including a real database failure after observation
  insertion that proves page/count rollback and safe retry.
- Existing integration coverage exercises full replay after connection termination,
  PostgreSQL restart, identity recovery, legacy reconciliation, maintenance exclusion,
  disabled/music libraries, source changes and fresh-setup learning deferral.
- Test fixture seeding now enters the actual lock/lease wrapper per operation.
  This is test-only scaffolding, not the runtime import lifecycle. End-to-end import
  tests use the actual `MediaSyncService` owner across the complete run.
- Test/security lint, type checking, copyright/dependency preflight, ESM static-import
  and mock-shape checks, and migration integrity passed. Security lint retains one
  unrelated pre-existing filesystem warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- Ownership drift check passed: 485 reviewed entries, of which 474 remain explicitly
  unresolved, eight cover the ingestion entry path and three cover reconciliation.
  Only three existing source fingerprints changed; the coordinate helper and recovery
  outcome callback were added as explicit dependency pins. Shared store/recovery
  entries remain conservatively unresolved: the scan does not prove indirect SQL or
  arbitrary injected callers safe. These counts are not vulnerability counts.
- Full backend coverage run: **1,494 suites / 44,679 tests passed** in 1,018 seconds.
  Statements/lines: 90.31%; branches: 84.61%; functions: 92.27%.
- The unchanged coverage ratchet passed using this new backend report and the
  existing report for the unchanged client. No new frontend test run is claimed.
- Markdown validation passed across 1,573 files.

## PR and operational boundaries

Two GitHub MCP searches for open PRs in `cloudbyday90/Classifarr` returned an empty
list on 2026-09-27. No open PR could be randomly selected, and no closed PR was
substituted or merged.

Tests use disposable synthetic PostgreSQL databases. No live library data, routing
configuration, credentials or running application container were changed. No release,
tag, deployment or dependency upgrade is part of this change.

## Recommendation and next component

Follow-up status (2026-09-27): the enumeration boundary described below is now
implemented. See [source enumeration completeness outcome](source-enumeration-completeness-outcome.md)
for verification, compatibility limits and the next provider-preflight component.

Keep the existing owner + generation checks + transaction rollback + static drift
gate. This is small and dependency-free, but remains cooperative application
coordination, not database-enforced authorization.

The next high-value component is **source-completeness validation before pruning
and enabling learning**. In `mediaSyncRun.mjs`, a short/empty array ends enumeration;
reported totals are recorded as progress but are not a completeness gate. A healthy
owner alone cannot establish that a provider returned the whole library.

The adapter boundary needs attention first: Plex currently maps missing container
metadata to an empty array, and Emby/Jellyfin map a missing `Items` value to an empty
array. Both attach totals to individual items, losing that evidence on empty pages.
Preserve a validated page envelope rather than making malformed responses look like
a confirmed empty library. This is a source-code finding, not a live incident diagnosis.

Official research supports that distinction: [Plex pagination](https://developer.plex.tv/pms/)
documents that actual page sizes can differ from requested sizes, that pagination
must be checked in the response, and that total size is optional. The
[Jellyfin SDK result contract](https://typescript-sdk.jellyfin.org/interfaces/generated-client.BaseItemDtoQueryResult.html)
separates items, start index and total count, with optional fields. These pages were
discovered through web search on 2026-09-27; Plex's oversized page was read through
a bounded local text extraction after the web reader rejected its size. The proposed
shared envelope is our design inference, not a guarantee made by either provider.

Acceptance for that follow-up:

1. Validate response envelopes; detect contradictory totals, repeated/non-progressing pages and premature
   termination using provider-specific evidence behind a shared movie/TV contract.
2. Preserve existing media and hold learning when completeness is unproven; retry
   with bounded attempts and a durable, actionable reason instead of warning floods.
3. Permit pruning only with a validated completion receipt. Define an explicit
   conservative policy for adapters without authoritative totals; do not fabricate
   certainty or assume a count alone proves completeness.
4. Prove recovery with synthetic truncated, duplicate, changing and complete captures,
   without enabling music, guessing IDs or changing routing.

This is a proposed next change, not a claim that these completeness checks were
implemented or that a live provider has returned incomplete data.
