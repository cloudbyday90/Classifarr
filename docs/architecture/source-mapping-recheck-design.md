# Saved mapping recheck status

## Design — 2026-10-11

A normal sync captures unresolved source declarations before reapplying a saved
mapping. During that interval, the previous successful mapping has no current
receipt. The existing `awaiting_sync` label incorrectly implies it never worked.
The observed local startup timing is consistent with this path; the transient
row was not captured, so regression tests must reproduce it directly.

Add read-only `lastAppliedAt` and `recheckState` fields to `source_mappings.v1`.
Keep existing status values and completion rules for older clients. A successful
historical timestamp is not current authority. With no successful application,
retain the existing first-verification wording. With a previous application but
no current receipt, distinguish waiting for verification from a currently active
library sync. Fixed failure guidance and revoked state take precedence.

An active hint requires the library and server enabled, the same server and media
type, the current observation's source digest and generation, a collecting
`media_sync` capture, the ingestion ledger and sync-status row referring to that
capture, and a granted advisory lock for this library in this database. A stale
running marker, timestamp or different library lock is insufficient. This is an
observational hint, never a write-admission check or proof the individual item
has reached its verification step. Interrupted `checking` stays unconfirmed;
there is no per-item live-attempt lease to justify hiding that diagnostic.

## Boundaries and completion

No schema, ownership, scheduler, retry, resource limit or provider behavior
changes. No extra work on fresh installations. The existing admin-only read is
still manual and paginated (50 plus sentinel); it performs no provider calls,
approvals, retries or database writes. The client validates optional fields,
accepts older responses, displays last-success context and announces refresh
without moving focus. Known failures retain their reason; unknown failures
retain sanitized guidance. Cancellation/unmount discards stale UI responses.

Reproduce first verification, successful apply, recapture, active owned sync,
missing owner, wrong generation/source, disabled configuration, failure and
revocation in isolated PostgreSQL. Add parser/component/browser regressions and
run both coverage suites and the ratchet. Rebuild only local Compose without
cache, evaluate the exact image and dump schema in an isolated container.

## Recommendations and tradeoffs

| Choice | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep every old receipt current | Stable-looking status | Conceals incomplete revalidation | Reject |
| Infer activity from a running row or age | Cheap query | Stale state looks alive | Reject |
| Add history and conservative activity hints | Clear without weakening completion | Extra bounded database reads; activity may change after response | Implement |
| Automatically approve conflicts | Less review | Membership alone does not resolve contradictory parent identities | Separate evidence-based design |

Next: [automatic identity reconciliation](source-identity-reconciliation-design.md),
first measuring which conflicting declarations can actually be proven equivalent.
Do not rematch shared Plex or copy local approval authority to another database.

## Research and separate PR trial

Official sources discovered/opened through MCP on 2026-10-11:

- [PostgreSQL pg_locks](https://www.postgresql.org/docs/current/view-pg-locks.html)
  documents granted locks, database scope and two-integer advisory keys. The
  observational view is not a transactional write-ownership guarantee.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  describes announcing status changes without moving focus or excessive alerts.
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) ties
  declaration major/minor versions to the represented library.

The current open set is #555 and #556. PowerShell `Get-Random` selected
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Trial its exact server declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0 locally, without merging. Registry
metadata reports no install scripts. Retain Node 24 and restore the trial if
typechecking or the existing runtime-major guard rejects it. Do not broaden this
batch into a runtime upgrade. No release or version bump.
