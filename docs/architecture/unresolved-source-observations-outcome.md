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

## Rebuilt runtime and real capture

Compose was rebuilt with `--no-cache --require-provenance` from clean source
`70ebb38ac480246d71dfc9f20a620833be3edebb`, then recreated without another build.
The container is healthy; migrations advanced from 250 to 251. The image revision
label matches the tested source. The following completion commit changes only
documentation, with no release or tag.

A real capture scanned **6,692 source items across ten libraries**, retaining
**19 unresolved memberships: 14 TVDB conflicts and five TMDb conflicts**. All ten
capture states completed, with no unusable keys, omissions or excluded libraries.
No IDs were selected or reassigned. A normal background sync also completed all
ten libraries and automatically retained the same observations, exercising the
production integration without an extra operator workflow.

The first observation-only capture's before/after assertion detected concurrent
inventory updates by the normal background sync; it was not counted as an
unchanged-inventory pass. After that sync completed, a repeat capture passed full
row-digest comparisons for trusted inventory, classification history and feedback.
Counts remained **6,692 inventory rows, 6,775 history rows and zero feedback rows**.
The capture helper wrote only source observation and capture-state tables.

The authenticated endpoint returned 200 with `Cache-Control: no-store` in 31 ms
in the local sample; anonymous access returned 401 and unsupported parameters
returned 400. Existing inventory, statistics, history and masked provider-setting
reads passed. The real TMDb candidate again returned 404 through the rebuilt
detail wrapper and inventory service, producing `identity_not_found` with verified
correlation while preserving the prior in-memory observation.

Desktop and 390-pixel mobile browser checks rendered nine example tables and all
19 examples, with no page errors, failed responses or requested writes. Native
headers, captions and keyboard-scroll regions were verified; the panel and page
fit the mobile viewport. The startup/sync/smoke log sample contained zero
error/fatal records, 19 expected identity-conflict warnings and eight slow-query
warnings. These are local observations, not performance or accessibility
certification. Private captures, screenshots and backups remain ignored.

## Recommended next item

Add an automatic guard against stale identity authority from pre-existing
inventory rows with current source conflicts. The read-only audit found that
**all 19 unresolved memberships match retained inventory rows with TMDb IDs**.
`mediaSyncLibraryStateService.findExistingMedia` currently reads those rows
without consulting conflict observations; `classificationAuthoritativeSignalShared`
can treat a match as authoritative existing media. The awaiting-decision
reconciliation query also reads existing inventory directly.

Guard these consumers, and inventory enrichment, while preserving historical
evidence and descriptive membership. Specify how incomplete, expired and omitted
captures affect eligibility before implementation; an absent preview is not
proof that an identity is valid. Test conflict arrival, duplicate placements,
concurrent capture and later resolution. Do not guess replacement IDs or require
routine manual labeling. This follow-up addresses a pre-existing consumer path;
the new observation store itself supplies no classification authority.
