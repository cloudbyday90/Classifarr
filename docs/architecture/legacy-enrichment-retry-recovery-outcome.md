# Legacy enrichment retry recovery outcome

Date: 2026-09-29. No release, version bump or live-data recovery.

## Delivered behavior

Library details now has **Review interrupted lookups**. It does no preview work
until opened. A concise table shows the exact batch, provider, attempts and expected
outcome. An administrator must attest that old instances and external writers have
stopped and will remain stopped. The application cannot prove this on their behalf.

The modular ESM contract, repository and service apply at most 50 reviewed records
per confirmation. Metadata and quota timestamps stay intact; attempts are not reset.
Exhausted records become failed, rather than receiving another attempt. Normal
workers acquire real claims for pending work. Disabled-library settings are not
changed, archived libraries remain excluded, and music is not processed.

Concurrent or changed records cannot be silently adopted. A database transaction
combines queue outcomes, derived item state and a unique actor-bound audit receipt.
Provider work is outside that transaction. A post-commit wake-up is best-effort;
the existing periodic retry schedule remains the durable-queue fallback.

The UI uses named API functions and non-persistent SWR, native labeled controls,
table headers, error alerts and outcome status messages. Titles are escaped.
Receipts must match the pending request, library and batch count and contain valid
audit identifiers and timestamps before the UI reports success. Uncertain or
malformed responses retain the same in-memory request ID for lookup/retry. A
missing receipt is not treated as failure; leaving the page loses this in-memory
reference. Audit receipts remain subject to existing retention policy.

## Operator steps after deployment

1. Verify that older Classifarr instances and external metadata writers are stopped
   and will not restart during recovery. Do not infer this from the age of a row.
2. Open the affected library, select **Review interrupted lookups**, and inspect
   the displayed titles, attempt counts and proposed outcomes.
3. Check the stopped-writer confirmation only after verifying it, then select
   **Recover reviewed lookups**. No library is automatically enabled or restored.
4. A receipt means recovery was recorded, not that provider enrichment completed.
   If the response is uncertain, keep the page open and use **Check recorded
   outcome** or **Retry same confirmation**; do not create a new request blindly.
5. If another batch remains, refresh and review that batch separately. Normal
   workers respect library settings, provider availability, source identity and
   quotas. A stale-review rejection requires a new review and confirmation.

These controls are implemented in source, but this turn does not deploy them to
the running instance or perform any operator confirmation.

## Validation

Focused checks passed before full regression testing:

- 14 backend contract, service-orchestration and authorization-route tests.
- 22 real-PostgreSQL recovery tests, including Plex/Jellyfin/Emby movie/TV completion
  through normal claims, stale revisions, partial/expired/current claim exclusion,
  bounded batches, quotas, exhausted attempts, concurrent confirmations, audit/state
  rollback, revoked access and lost commit replies.
- 25 frontend component/API tests covering opt-in reads, exact batch presentation,
  escaped content, explicit attestation, rejected review, uncertain-response lookup,
  same-request retry, malformed/mismatched receipts, stale navigation responses and
  unavailable browser randomness.
- Disposable PostgreSQL schema generation and authoritative comparison passed.
  The only schema addition is a unique receipt index; the snapshot includes 300
  migrations. The owned schema-check containers and temporary data were cleaned up.

Full backend validation passed: 1,530 suites / 46,275 tests. Full PostgreSQL
integration passed: 195 suites / 2,295 tests; one existing opt-in suite/test was
skipped. The final full frontend suite passed 405 files / 5,714 tests after the
receipt-validation improvement. Total: 54,284 passing tests, plus the separate
installation checks below. Focused counts above are included in these totals.

Lint, type checks, dependency/copyright/ownership preflight, ESM checks, all four
policy gates, production frontend build, migration integrity and Markdown checks
passed. The coverage ratchet passed without lowering any baseline: backend lines
90.23%, branches 84.90%, functions 92.13%; frontend statements 86.02%, lines 87.97%,
branches 78.55%, functions 85.48%. These checks are not a whole-platform security or
accessibility audit.

## Clean-source installation acceptance

`node scripts/run-runtime-installation-acceptance.mjs --ci` passed all 12 checks
with a clean source tree at `bcdc4150d82059295ddc1999dd5fd7daca67f108`.
The receipt completed at `2026-09-29T10:29:23.980Z`; its generated local path is
`.tmp/ci/runtime-installation-acceptance.json` (ignored, not committed).

- Published baseline: `v0.48.4-beta`, source
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, immutable image digest
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Tested candidate image:
  `sha256:fa966a0e7ec7520dc5da914028b99474108c16309f9bb2fd06c3e4182f4b7fe3`.
- Fresh and upgraded PostgreSQL 18.6 installations reached 300 migrations; the
  published baseline began at 222 migrations.
- Passed published provenance, fresh operational seeds, fresh scheduler progress,
  backfill crash recovery, published startup/export, persisted-volume migration,
  container death during restore, rejection of unverified normal startup,
  rollback/verified retry, movie/TV recovery-to-learning, normal restart/profile
  preservation and upgraded startup scheduler progress.
- Cleanup passed for this isolated Compose project, including its disposable
  volumes and candidate image. These synthetic test resources were deleted; no
  user data was removed. The local schema-test image remains available for reuse.
- The live Classifarr container's ID, image and startup time remained unchanged;
  it remained healthy with zero restarts and no recorded OOM kill.

This rehearsal verifies installation and existing recovery paths. The separate
real-PostgreSQL suite verifies the new reviewed legacy-retry workflow. Neither
test substitutes for an operator's stopped-writer verification on a real instance.

## Research, PR selection and recommendation

The separate [design](legacy-enrichment-retry-recovery-design.md) records official
PostgreSQL, node-postgres, HTTP, W3C and AWS sources, alternatives, costs and the chosen
stack. Existing Vue/SWR, small ESM modules and PostgreSQL transactions were retained;
no new runtime dependency or workflow engine was needed.

Two GitHub MCP checks returned no open pull requests for `cloudbyday90/Classifarr`
in this round. No random open PR could therefore be selected, applied or merged.

Next: durable provider-aware retry due times and bounded readiness wake-ups, with
restart and quota-reset acceptance tests. This closes the remaining scheduling gap
instead of adding another generic recovery dashboard or bypassing ownership checks.
