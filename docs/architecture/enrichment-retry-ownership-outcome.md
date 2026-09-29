# Independent enrichment retry ownership: outcome

## Root cause and implementation

Date: 2026-09-29. The retry queue selected pending rows before separately marking
them processing. Two instances could both select one row. Provider helpers then
wrote metadata by item ID, and terminal/error updates used queue ID alone. A
worker that outlived recovery could still overwrite a newer worker's results.

Implemented the [ownership design](enrichment-retry-ownership-design.md) using
small ES modules for claims, processing and result persistence. The schema adds
nullable `claim_token` and `claim_until` columns, with matching fresh-install
snapshot changes. No library ID, server brand or media title is hard-coded.

- Atomic single-row claims use `SKIP LOCKED`, a fresh UUID and a stored deadline.
- Provider calls happen outside transactions and return evidence without writing
  item metadata. Existing provider routing, caches and quota handling remain.
- Guarded transactions save metadata, retry outcome/fallback and item state
  together. Source changes discard the response and leave a fresh pending retry.
- Success messages and fallback scheduling follow commit. Obsolete claims exit
  without modifying their successors; uncertain commits are not replayed.
- Duplicate enqueue preserves processing claims. Recovery handles at most 50
  expired, token-bearing claims per pass and updates their item state atomically.
- Each processing invocation honors the existing quota/API limit (50 by default)
  and visits each row once, one provider call at a time. Monthly Tavily deferral
  and bounded attempt exhaustion remain.
- Inactive or unsupported libraries/items are not claimed. Music stays excluded.

## Compatibility and limits

Pending legacy rows acquire ownership when actually claimed. Existing processing
rows without a token are preserved, not assigned an invented owner or reset based
on age. They need a stopped-writer review before a new retry can be authorized.
This intentional safety boundary can leave legacy work waiting; it is not a
claim that every historical processing row now self-heals automatically.

Stop older, unfenced application instances before deployment. This cooperative
protocol cannot constrain old binaries or external SQL writers. Provider calls
and shared caches/accounting are not exactly-once. Already-present evidence is
preserved rather than overwritten by a concurrent retry response.

The lease defaults to 20 minutes. A positive integer
`ENRICHMENT_RETRY_STALE_MS` overrides it, capped at one hour; invalid values use
the default. The worker does not renew leases indefinitely. An expired provider
request may finish, but its result cannot write; normal recovery can retry within
the existing attempt budget. Claim transactions use bounded lock, statement,
idle and total transaction timeouts, as in the main queue guard.

## Verification

Focused unit and real-PostgreSQL tests cover claim overlap, expired/replaced/
cancelled/missing authority, late provider results, crash recovery, source and
library changes, TV parity, music exclusion, atomic fallback, state-write
rollback, expiry during writes/lock waits, lost commit replies, monthly deferral,
attempt exhaustion and repeatable legacy schema migration.

The full suites passed: 46,202 backend tests in 1,527 suites, 2,273 PostgreSQL
integration tests in 194 passing suites, and 5,674 frontend tests in 403 files.
One pre-existing opt-in integration suite/test was skipped. The targeted retry
unit suite has 44 tests; the new PostgreSQL ownership suite has 20 tests.

Lint, type checks, dependency/copyright/ownership preflight, ESM checks, policy
gates, frontend build, Markdown lint, migration integrity and the disposable
PostgreSQL schema comparison passed. No coverage threshold was lowered.

The clean final backend coverage rerun passed the same 46,202 tests. The coverage
ratchet passed with backend lines/statements 90.23%, branches 84.88% and functions
92.14%; frontend statements 85.96%, branches 78.48%, functions 85.41% and lines
87.92%. Combined full-suite results total 54,149 passing tests, excluding the
single opt-in skip and the separate 12 installation checks.

### Clean-source installation acceptance

`node scripts/run-runtime-installation-acceptance.mjs --ci` passed all 12 checks
and cleanup at `2026-09-29T09:47:22.311Z` against clean source
`08f9c4180d15a96f3e84b4851ac2ae5cbad0f44f`. The published baseline was
`v0.48.4-beta`, revision `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, verified at
image digest `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
The tested candidate image was
`sha256:beecf6d8f59c15b25bdb50a56adf0ad430265f9b6b6ea88f969391d857eed6d4`.

Fresh and upgraded PostgreSQL 18.6 databases both reached 299 migrations; the
published baseline had 222. Checks covered fresh seeds/startup, backfill crash
recovery, published startup/export, persisted-volume migrations, process death
during restore, rejection of unverified normal startup, rollback and verified
retry, movie/TV recovery to learning, normal restart/profile recovery and upgraded
scheduler progress. This was the standard installation profile, not a new
resource-budget benchmark. The ignored receipt is
`.tmp/ci/runtime-installation-acceptance.json`.

No live data, routing settings or application container have been changed.

## Recommendation and next item

Retain PostgreSQL-backed claims and short same-client transactions. This adds
database round trips and two columns, but avoids another broker/service and
network-held locks. The detailed pros/cons and official sources are in the design.

Next: a reviewed legacy-retry reconciliation path. Show how many tokenless
processing rows are blocked, require confirmation that older writers stopped,
then transactionally requeue only the exact reviewed rows. Preserve metadata,
attempt limits and an audit receipt; reject changes since review. Test the
fresh/upgrade path and let ordinary workers perform the backfill afterward.
Do not substitute automatic age-based takeover for that missing evidence.

GitHub's open-PR search returned no eligible PR; none was substituted or merged.
No dependency was added, version bumped or release created.
