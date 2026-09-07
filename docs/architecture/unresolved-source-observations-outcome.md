# Unresolved source observations outcome

Date: 2026-09-07. See the separate
[design and alternatives](unresolved-source-observations-design.md).

## Implementation

Normal library sync now automatically retains rejected source observations in
separate tables, with per-library capture generations, first/last-seen times,
sanitized descriptive fields and fixed issue categories. Parameterized page
writes have a 1,000-item bound and a 20,000-record retention ceiling per library.
Failed, incremental, expired, capacity-limited and uncaptured states remain
explicit. Unusable source keys are counted without inventing an identity.

Superseded captures cannot change newer evidence. Valid duplicates do not clear
a rejection within the same capture; a later consistent capture can clear it.
Successful full captures remove unseen observations only when all source keys
were usable. Read-time retention excludes observations older than 30 days;
subsequent capture purges them physically. Deleting a library or server cascades
its observations. This is bounded current evidence, not permanent history.

An authenticated, rate-limited, no-store API feeds a dedicated Libraries panel.
The panel reports coverage, capture counts and up to five recent examples for
each of the first 12 active libraries, using native tables, captions, headers,
keyboard scrolling, escaped text and loading/error states. No operator labeling
or ID assignment is required.

## Authority and limits

The observation store has no provider candidate IDs and does not write trusted
inventory, labels, classification history, enrichment or routing decisions.
Existing trusted rows retained by prior sync behavior are not automatically
revoked by this change. Source conflicts remain unresolved. Captures are paginated
observations of a changing source, not atomic snapshots or independently labeled
classification studies. Counter-evidence and automatic routing remain gated by
their existing readiness contract.

Omitted records can be admitted during a later capture after capacity becomes
available. Capture counters describe source rows encountered, including repeated
keys; retained counts describe distinct server/library/source-key memberships.
The summary's library selection and preview bounds are visible to the user.

## Validation

The complete backend suite passed **31,874 tests across 1,108 suites** with
coverage. The complete client suite passed **4,803 tests across 343 files** with
coverage. The repository coverage ratchet passed. PostgreSQL integration passed
**45 tests across three suites**, including repeat capture, duplicates, failure,
incremental/full cleanup, stale generations, membership movement, retention,
capacity and identity-observation preservation. A final focused backend run
passed **86 tests across five suites**, including sync lifecycle integration.

Backend/frontend type checks, changed-file ESLint, production dependency checks,
ESM static-import and mock-shape checks, Markdown lint and whitespace checks
passed. A disposable PostgreSQL 18 container generated the schema snapshot and
a second fresh container verified it against migrations. The local pre-change
database backup is checksum-verified and readable (44,530,335 bytes); the prior
image is retained for rollback.

GitHub MCP returned zero open pull requests on two checks. No random open PR
could be selected, and no unrelated or closed PR was substituted. No PR was
merged and no release or tag was created.

The rebuilt runtime and real capture are the remaining validation steps; their
results will be recorded before integration into main.

## Recommended next item

Assess whether pre-existing trusted inventory rows whose source now reports an
identity conflict can still supply stale identity authority to enrichment or
classification. Add a bounded, automatic consumer guard if this path is present,
while retaining historical evidence and descriptive library membership. Do not
guess replacement IDs or require routine manual labeling. A read-only coverage
audit should establish the affected paths and counts before changing consumers.
