# Interrupted-import review lifecycle: outcome

Date: **2026-10-01**. Base revision: `e8e8ca3b`.

## Delivered

Implemented the [lifecycle design](legacy-ingestion-review-lifecycle-design.md)
in the existing ESM composable and recovery component. Confirmation now uses one
shared eligibility predicate. Visit generations reject obsolete previews,
receipts, errors and cleanup; actual preview loading disables the controls.
Recorded receipts remain recorded if refreshing progress fails. No backend or
API contract, configuration, schema, dependency or version change was needed.

Four newly added component regressions failed against the original implementation
before the fix: refresh remained actionable, a late success and late rejection
leaked into a return visit, and an old preview reappeared after returning. They
pass with the lifecycle fix.

## Verification

- Focused component/composable tests: **35 passed**. Includes visit changes,
  unmount, late cleanup, receipt lookup, refresh gating, fresh acknowledgment,
  uncertain same-request retries, reconnection and progress-callback failure.
- Existing server contract/route tests: **10 passed**.
- Disposable PostgreSQL recovery suites: **70 passed**. These cover reviewed
  recovery, owned replay, rollback and provider-agnostic ingestion/backfill,
  using synthetic data; they do not recover the live records.
- Chromium browser rehearsals: **2 passed**. The enabled-library flow checks
  refresh locking, renewed keyboard confirmation, the exact refreshed revision,
  one recovery POST and no settings writes. Disabled-library compatibility stays
  intact. Both mobile screenshots were generated; the enabled receipt screenshot
  was inspected and the tests check horizontal bounds at 390 pixels.
- Full frontend coverage: **5,852 tests in 413 files passed**. Statements 86.19%,
  branches 78.86%, functions 85.60%, lines 88.07%.
- Repository lint, backend/frontend type checks, frontend production build,
  copyright, ownership review, development/production dependency checks, ESM
  static-import/mock-shape checks and Markdown lint passed (1,743 documents).
- The unchanged coverage ratchet passed. Its backend input is the existing
  October 1 coverage report for unchanged backend source, not a new full backend
  run. The focused backend unit/integration results above were rerun here.

Focused commands (run from their workspace):

```powershell
# client
node scripts/run-vitest.mjs run src/__tests__/components/LegacyIngestionReview.test.js src/__tests__/composables/useLegacyIngestionReview.test.js
node scripts/run-playwright.mjs test legacy-ingestion-reconciliation.spec.js
# server
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns='legacyIngestionContract|librariesIngestionReconciliation'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns='legacy-ingestion-reconciliation|library-ingestion-recovery'
```

## Live state and limits

The current local container remained healthy during read-only investigation.
Two libraries have eight unfinished legacy sync records and no matching ownership
ledger. The selected read-only snapshot reported no active ingestion owner for
them and no collecting capture. No stopped-writer attestation was made on the
operator's behalf. No records, media, ownership, routing or log retention were
changed. These warnings remain unresolved by this UI fix.

No deployment/rebuild, release, tag or PR merge is part of this change. The prior
no-cache deployment is a separate completed operation. The current image does not
contain this newly committed client change until a subsequent build/deployment.

Both GitHub MCP and the saved GitHub CLI login returned **zero open PRs** in
`cloudbyday90/Classifarr`. There was no random open PR available to implement;
none was invented or substituted with a closed PR.

## Next high-value item

For the live blockers, establish that older/external writers are stopped, then
use the existing **Recover and resume import** review and verify the full scan
and downstream backfill complete. A receipt alone is not that verification.

For the next code component, add an authenticated, bounded recovery-operation
history backed by server receipts so an administrator can find a submitted
request after navigation or reload without browser-persisted approval. Keep
actor/library checks and retention limits; absent or expired receipts must remain
an unknown outcome, never permission to invent success or retry with new intent.
Acceptance should include a committed-but-lost HTTP response, navigation/reload,
revoked access, expired history and independently verified import progress.

That improves operator recovery; it does not replace the separate database writer
boundary needed for confirmation-free adoption of arbitrary legacy writes.
