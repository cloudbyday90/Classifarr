# Inventory recovery view: outcome

## Delivered behavior

The [design](inventory-recovery-view-design.md) is implemented as modular ES
modules and Vue components, without new dependencies or a database migration.
Libraries links to **Metadata recovery** at `/libraries/recovery`.

Three count cards show recorded open cases, movies and TV shows. They use the
same SQL population as a keyset-paginated list of at most 25 rows. The next cursor
uses one lookahead row. Counts do not imply complete acquisition, placement
accuracy or successful recovery. Current source conflicts explicitly block retry
presentation; expired deadlines indicate eligibility, not guaranteed execution.

Case details include the title/library, original typed TMDb ID, shared actionable
report instructions, latest check, completed attempts, candidate evidence and
retry time. A candidate remains review-only. Plex source-correction guidance is
shown only for source-review cases, not as a cure for authentication or outages.
Existing source-conflict and missing-ID workflows are preserved, not retired.

The list is database-only. Expanding a Plex case performs a separate link lookup
using the existing resolver. The lookup checks the current item/case and active
source, then rechecks administrator authority and item/library/server revisions
after I/O. Changed or resolved cases cannot return late links. An offline lookup
does not poison a cache: **Check Plex link again**, or reopening details, can
recover it later. This verifies a server identifier and link shape, not current
item existence or metadata correctness. No speculative non-Plex URLs are added.

Both endpoints require an administrator access session plus an active current
administrator database row. API keys, scoped tokens and refresh tokens are
rejected. Responses are no-store, queries are parameterized and validated, and
the new router admits at most 120 reads per IP per 15 minutes. This accommodates
normal 30-second list polling plus bounded manual details reads; many tabs still
share that budget. Credentials and source URLs never enter the response.

SWR retains data only within the mounted view. Pausing freezes the displayed
snapshot even if an older request completes, while background jobs continue.
Manual refresh while paused is explicit; read failures/offline state hide case
data instead of claiming a clean inventory. Native headings, lists, details,
buttons, visible focus and status text support keyboard/screen-reader use. No
global WCAG conformance claim is made.

## Validation

Focused backend and PostgreSQL tests cover authorization, pagination, inactive
and unsupported source exclusion, source/configuration changes during link I/O,
failure-to-success link reads, malformed records and unchanged item revisions.
Frontend tests cover hostile text/URLs, no local-storage writes, deferred link
fetching, page boundaries, permission loss, malformed snapshots and pause races.
Browser acceptance covers keyboard expansion, offline-to-available Plex links,
desktop/narrow layouts and zero mutation requests against synthetic fixtures.

Final validation on 2026-09-27 passed:

- Backend coverage: **1,484 suites / 44,291 tests**.
- PostgreSQL integration: **178 suites / 2,009 tests**, with one existing
  suite/test skipped. The final focused recovery integration run passed all five
  tests, including a source conflict in a collecting capture.
- Frontend coverage: **390 files / 5,492 tests**.
- Chromium acceptance: **one scenario passed**, including desktop and 390-pixel
  layouts. Both screenshots were inspected; document and main-content widths
  were checked for overflow.
- Backend/frontend type checks, backend test lint, client lint, dependency checks,
  ESM import/mock-shape checks, copyright and Markdown checks passed. Security
  lint retains only the pre-existing non-literal-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- The frontend production build and coverage ratchet passed. Backend coverage is
  90.31% statements/lines, 84.57% branches and 92.29% functions; frontend coverage
  is 85.75% statements, 78.17% branches, 85.20% functions and 87.75% lines. The
  generated frontend LCOV HTML summary was copied unchanged to the ratchet's
  expected `coverage/index.html` path; coverage values were not edited.

The initial full runs caught two new test-style violations (mock reset and final
closing-line conventions), which were corrected. They also exposed three older
Ollama capability assertions whose August 28 fixture expired against the real
clock on September 27. Those tests now inject a deterministic clock and explicitly
check the exact thirty-day boundary, expiration and future timestamps. Production
freshness limits and authorization behavior were not relaxed. Final full reruns
passed after these corrections.

The deployed application and private library data are not changed by these
fixture-backed tests. No release, version bump, image publication or PR merge is
part of this change. GitHub MCP found no open repository PR to select on
2026-09-27.

## Next bounded component

Verified credential wakeups are now implemented; see the
[design](inventory-credential-wakeup-design.md) and
[outcome](inventory-credential-wakeup-outcome.md). The next bounded component is
end-to-end recovery outcome measurement, distinguishing eligibility, queue
admission and persisted metadata. Use those results to tune automation instead
of adding another overlapping status screen or guessing replacement identities.
