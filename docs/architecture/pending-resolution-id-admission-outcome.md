# Exact ID admission for pending resolution outcome

November 22, 2026 Eastern. Implementation of the agreed
[design and official research](pending-resolution-id-admission-design.md).

The web route and both Discord pending-answer formats now use the same
canonical positive safe-integer History ID guard. The shared resolver also
checks direct calls before starting a transaction. The web route rejects
invalid path segments before destination lookup. Discord passes the raw
History segment to its answer handler for validation before lookup.

Larger rows remain visible. The web projection uses its existing unavailable
answer state, and both current and legacy Discord producers omit pending
answer controls for unsupported IDs. The retry surface remains available.
Safe answer fingerprints and completed receipt matching use their existing
representation. Authorization, current destination checks, stale handling,
postcommit routing and existing learning gates still govern admitted answers.

## Verification

- The isolated PostgreSQL suite used the actual web route and resolver with
  two adjacent larger rows beside the maximum safe ID. Invalid targets left
  all three rows unchanged. An explicit safe destination choice wrote the
  expected fingerprint, and exact completed replay made no further route
  call. A changed replay was rejected and both neighbors remained unchanged.
- 214 focused server tests passed. They exercised raw Discord ID admission,
  current and legacy component generation, the shared transaction boundary,
  and the existing answer-fingerprint and replay contracts.
- The focused PostgreSQL run passed 61 tests, including historic refresh and
  ordinary retry compatibility plus the separate profiling suite. The client
  action tests passed 31 cases. Twelve Chromium scenarios passed, including
  safe explicit selection, bulk review behavior and historic paging.
- Astra identified the legacy confidence notification's pending buttons
  during review. The producer now shares the admission guard. GitHub showed
  no open PRs or Dependabot branches eligible for rebase at assessment.

## Next recommended item

Trace exact History IDs through native pending provenance, destination
evidence and automatic exact-item learning before enabling larger resolution
targets. Define how fresh fingerprints encode decimal strings while existing
safe fingerprints and completed receipts keep their original bytes. Then
verify explicit, bulk and Discord answers together with exact replay.
