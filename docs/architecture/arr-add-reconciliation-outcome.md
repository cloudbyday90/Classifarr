# Radarr and Sonarr Add Reconciliation Results

Reviewed: 2026-10-03. No release, version bump or deployment change.

## Outcome

Routing now verifies the provider's media ID and actual destination before
reporting success. Failed pre-reads do not authorize an add, and an HTTP conflict
or successful POST is no longer accepted as proof on its own. Sonarr lookup
must return the requested TVDB ID; an unrelated first result is rejected.

Three small ESM services separate identity/path checks, safe error classification
and the shared read/add/read-back sequence. Existing API result fields and reason
IDs remain unchanged. Filtered reads also serve reclassification move planning;
those callers still perform their own move-specific identity/path checks.

| Observed state | Action and result |
| --- | --- |
| Matching item already at the selected root | No POST; verified as already present |
| Confirmed absence, add and read-back agree | One POST; verified as routed |
| Provider saved the item but its response was lost | One read-back; verified without replaying the POST |
| Conflict, but no matching item or wrong destination | Not routed; review required |
| Initial read failed, malformed, redirected or oversized | No POST |
| Add response or read-back remains uncertain | Not routed; no automatic retry loop |

## Operator guidance

No Compose, Unraid or Synology template change is needed. Existing destinations,
monitoring choices, quality profiles and media files are not changed by recovery.
Configured provider URLs must point directly to their API; these reads/adds do
not follow redirects. Verify the API key and connectivity if the initial check
fails. For an unconfirmed result, inspect the item by TMDb/TVDB ID and its path
in the mapped provider before retrying. Do not delete it merely to clear a
conflict, and do not treat successful classification as proof of routing.

Root comparison is deliberately conservative: equivalent aliases or different
case may need review. Verification proves observed placement, not downloaded
files, completed searches, full settings equality or exactly-once effects.
Sonarr metadata lookup and configuration-default resolution remain separate
existing prerequisites. This change adds no durable retry scheduler.

## Validation

- Two routing regressions failed before the fix: unverified conflict and an
  existing movie outside the intended root were incorrectly reported successful.
- Focused validation passed 339 tests across nine suites, including provider
  adapters, routing, identity/path validation and reclassification move planning.
- Forty real loopback-HTTP cases exercised both production provider clients:
  saved-but-lost responses, conflicts, duplicate validation, unavailable and
  malformed reads, wrong destinations, rejected redirects and oversized decoded
  gzip responses. No external provider or live media was contacted.
- Request-contract tests verify filtered IDs, 10-second reads, 30-second adds,
  2 MiB decoded response limits, redirect refusal and safe timeout errors.
- A separate local check withheld each POST response until the production
  30-second deadline expired. Both clients recovered the saved item with exactly
  two GETs and one POST, using real HTTP rather than a mocked timeout.

- Full backend coverage: 50,093 tests in 1,637 suites passed. One existing
  Linux-only directory-fsync test is skipped on Windows; no skip was added.
- Full frontend coverage: 5,912 tests in 416 files passed, and the production
  build passed. Both reports were regenerated for this validation run.
- All three new services have 100% line, branch and function coverage. The
  combined coverage ratchet passed; backend line/branch coverage is
  90.06%/85.47%, frontend 88.09%/78.92%. No thresholds were lowered.
- Repository lint, backend/frontend type checks, both backend Knip modes,
  copyright, ESM import/mock-shape checks, syntax and diff whitespace passed.
  Markdown lint checked 1,781 documents with zero errors.
- The inventory ownership drift check passed. Existing unresolved shared-writer
  debt is unchanged; this is not authorization to assume legacy ownership.

Live Classifarr, installed providers, media and deployment settings were not
modified or restarted. These are local tests, not deployment acceptance or a
claim that the new commit's remote workflows have completed.

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr
PRs. There was no PR to randomly select or implement; none was merged. All seven
GitHub workflows for the preceding queue-recovery commit completed successfully.

## Recommendation and next work

Adopt the [design and researched recommendation stack](arr-add-reconciliation-design.md):
strict identity, filtered pre-read, one add, bounded read-back and verified path.
Benefit: completed adds can recover from response loss without a duplicate
write. Cost: an extra read and explicit review when state cannot be confirmed.

Next: preserve routing outcomes consistently before adding restart recovery.
`classificationServiceCore` persists the returned routing reason/error, but
`QueueAdminService.manualClassifyTask` currently discards that result and records
classification completion. It also holds its database transaction across the
provider request. Classification completion is not routing confirmation. That
manual path needs an explicit outcome contract and regression tests first.

Then audit existing durable routing receipts and history for recovery when
outcomes remain unconfirmed across a longer outage or process restart.
Preserve the original provider, identity and destination intent, recheck current
authorization/configuration, and reconcile with bounded reads before considering
another write. Prefer existing records over a new outbox unless they cannot
represent this lifecycle. Do not expand classification retries blindly.
