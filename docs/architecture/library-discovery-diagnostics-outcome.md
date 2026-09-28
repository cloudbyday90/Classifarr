# Library discovery diagnostics outcome

Date: 2026-09-27. Status: Unreleased. No release or live deployment created.

## Delivered behavior

Settings → Media Server now explains the saved connection's discovery outcome:
what failed, when discovery last succeeded, and the next useful recovery step.
Jellyfin has independent array-contract tests and never probes Emby's paginated
query or legacy fallback. Plex and Emby use the same diagnostic lifecycle, with
their own provider contracts. Movie/TV eligibility and music exclusion are unchanged.

Small ESM modules separate failure classification, observation, persistence and
presentation. A no-store administrator GET reads one database row, and Vue's
non-persistent SWR refreshes the card without issuing provider requests. Keyboard
controls, text labels, an accessible status region and optional details avoid
color-only meaning. A count of source libraries is not presented as an import
percentage or an accuracy claim.

The underlying issue was loss of useful error categories at the provider wrapper,
not evidence that all provider failures share one root cause. HTTP status and
transport codes now survive as a fixed vocabulary. Tokens, URLs, raw responses,
exceptions and library names are not retained in the diagnostic record.

## Recovery and upgrade behavior

- Authentication/permission failures: update the saved token or account access,
  save the connection, then sync libraries. A network retry cannot repair access.
- Unreachable/timeout/server error: restore connectivity or server health, then
  retry. The existing periodic discovery also updates status after recovery.
- Invalid/oversized library lists: inspect the server and proxy response; do not
  relax completeness or response-size guards. Existing inventory remains intact.
- No result recorded: run Sync Libraries after configuration, or allow the next
  existing scheduled discovery. Legacy `last_sync` is not treated as new evidence.
- Outcome unrecorded: inspect ongoing work before retrying. Elapsed time never
  authorizes taking ownership away from a potentially active worker.

The migration adds one row per source and a database-managed connection revision.
Fresh installations get the same schema. Completion is attempt-bound and
revision-bound; changed credentials, provider, address or activation invalidate
old evidence, including change-away/change-back cases. A successful catalog merge
is recorded only after commit. Diagnostic write failures do not fail the merge.
Archive review still requires its own fresh remote read and explicit confirmation.

Refresh status only reads stored evidence. Sync Libraries retains the existing
enabled-library content-sync and classification-queue refill behavior. This change
does not add polling jobs, automatically retry invalid credentials, change routing,
enable archived libraries or infer that ingestion/backfill has finished.

## Verification

Focused checks cover safe failure categories, redaction, revision changes,
overlapping attempts, late completion, inactive/deleted sources, storage failure,
fresh setup, and the administrator-only read contract. Disposable PostgreSQL tests
cover both migration upgrades and fresh-schema installation. Real HTTP fixtures
exercise Jellyfin 401/403/404/429/503, malformed/truncated/oversized responses,
cancellation, inventory preservation and recovery. Transport timeout/unreachable
classification is also checked at the adapter boundary.

Browser verification uses the real settings view with synthetic API responses:
keyboard refresh and details, desktop/mobile layout, no writes on refresh, and
post-sync status update. The mobile screenshot waits for the existing navigation
transition to finish rather than capturing an overlapping drawer mid-animation.

Final local validation:

- Backend unit coverage: 1,505 suites and 45,206 tests passed.
- Backend integration: 185 suites and 2,130 tests passed; one existing test/suite
  remained skipped. Tests used disposable PostgreSQL, not the live database.
- Frontend coverage: 401 files and 5,638 tests passed.
- Focused Playwright browser check passed, including keyboard interaction and
  desktop/mobile screenshots.
- Coverage ratchet passed with no regressions: server statements/lines 90.32%,
  branches 84.72%; client statements 85.94%, lines 87.90%, branches 78.44%.
- Lint, both type checks, client production build, migration/snapshot checks,
  ownership/copyright/dependency preflight, four policy gates, ESM checks and
  Markdown lint passed. No validation baseline was raised.

The broader naming check exposed and corrected a pre-existing substring-matching
bug, documented separately in the [runtime-phase validation outcome](production-naming-runtime-phase-check.md).
No runtime state fields were renamed and no validation baseline was raised.

The GitHub MCP open-PR search returned no open PRs for this repository. No random
PR could be selected; no closed PR was substituted, and no PR was merged.

## Recommendation stack and next work

Keep PostgreSQL, bounded native HTTP, Express ESM services and Vue/SWR. The
[design](library-discovery-diagnostics-design.md) records alternatives, tradeoffs
and official Jellyfin, HTTP, PostgreSQL, OWASP and W3C references checked on the
research date. Latest-state persistence is low overhead and survives restarts;
its limitation is that it cannot reconstruct a full incident history.

Next: add reason-aware catalog recovery admission to the existing library-sync
scheduler, not a second worker. Today it schedules ordinary discovery every six
hours and once at startup; this work records outcomes but does not change retry
timing. Use a bounded, jittered retry budget for transient failures, a saved
credential/configuration change to wake access failures, and the existing ownership
and ingestion-readiness guards. Prove outage → recovery → complete import → learning
readiness for Jellyfin, Emby and Plex without duplicate work or relaxed validation.
That converts these diagnostics into controlled recovery rather than another
dashboard-only iteration.
