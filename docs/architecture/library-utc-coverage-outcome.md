# Per-library UTC coverage outcome

Date: 2026-09-07. See the separate [design and research](library-utc-coverage-design.md).

## Result

The statistics overview now shows original-method capture coverage by recorded
library within the existing 14-day UTC window. Each row partitions retained
history into window, older, future/at-cutoff and unknown-time events, and partitions
window events into captured, unrecorded, invalid and unsupported provenance.
Empty windows display N/A. This passive view adds no operator task, endpoint,
provider request, schema change or routing decision.

The SQL aggregation, count validation and response projection are separate ESM
modules. Server and client reconcile the same UTC population, reject inconsistent
payloads, and enforce stable ordering and a 200-group cap. Complete global totals
include omitted groups. Every omitted group must have an omitted retained event;
an impossible truncation claim is rejected. Only catalog labels and aggregate
counts reach the new view. The existing authenticated, no-store overview and
five-second query timeout remain in use.

Recorded library means the current history record, which can change through
resolution or removal. Inactive and unassigned/removed groups are visible;
catalog libraries with no retained history are omitted. These counts do not
establish current inventory membership, original candidate placement or accuracy.

## Local Compose observation

The current query was observed in a repeatable-read, read-only transaction against
the running PostgreSQL 18.6 Compose service at 2026-09-07T13:14:50.762Z. Its older
schema has no recording-instant column, so the local observation adapter explicitly
projected unknown instants. Existing feedback compatibility projections were used
only after verifying that the corresponding retained feedback population was
empty. This is observation scaffolding, not an application fallback or migration.

- 6,772 retained events across 11 recorded-library groups; no truncation.
- All 6,772 recording times were unknown, so all UTC windows were empty and their
  coverage was N/A. No timestamps or classification labels were inferred.
- The new projected payload was 3,323 bytes; the observation took 321.078 ms.
- Zero production writes and zero provider requests. Raw snapshots remain ignored
  under `.tmp` and are not committed.

This single observation establishes query compatibility and honest missingness
for that data. It does not measure classifier error or predict production latency
on larger installations.

## Validation

- 100 server unit tests passed across six focused suites, including malformed
  identities, unsafe counts, temporal/status partitions and impossible omissions.
- 123 PostgreSQL integration tests passed across eight suites. New cases cover
  UTC boundaries, both offsets of a repeated DST hour, session-zone independence,
  inactive/removed/unassigned libraries, resolution and empty history. Existing
  history writers, feedback evaluation/receipts and temporal views also passed.
- After the final omission guard, the two directly affected integration suites
  passed again: 49 tests, including the real 201-library cap fixture. The 5,000-event
  aggregate fixture took 74.127 ms on that run.
- 89 focused client tests passed across eight files. They cover escaped names,
  incomplete and inconsistent responses, fractions, empty windows and truncation.
- The browser flow passed in Pacific/Honolulu with six distinct native tables,
  scoped headers, keyboard horizontal scrolling, contrast checks, 320/390-pixel
  reflow and zero writes. Desktop and narrow captures were visually inspected.
  A taller 320-pixel-wide artifact captures the entire new section inside the
  app's scrollable main; interaction checks use the normal 320x844 viewport.
- The new 201-group fixture projection stays below 85,000 bytes; both existing
  temporal payload checks and the earlier bounded attribution payload check still
  pass. This fixture threshold is not a universal byte limit for every possible
  255-character Unicode catalog name.
- Scoped ESLint, both typechecks, ESM static-import/mock-shape checks and
  production dependency checks passed. Markdown lint, migration integrity and
  whitespace checks passed.
- `classifarr:library-utc-local` built from the staged Git tree. A fresh disposable
  container bootstrapped successfully and its schema matched the authoritative
  snapshot without drift. The running user Compose service was not redeployed.

The full suites and combined coverage ratchet were not run; this change adds no
endpoint or dependency. These checks do not certify every accessibility or
security property and do not supply independent human labels.

## Open PR availability

GitHub MCP returned zero open PRs at task start and final readback. Random
selection from that empty population was unavailable. No PR was fabricated,
reopened or merged.

## Recommendations and next item

Recommended stack: immutable recording instants, one bounded SQL aggregation,
strict modular ESM projections, an escaped native Vue table, and real PostgreSQL
partition/cap tests. Benefits are automatic visibility, explicit missingness and
consistent global totals. Costs are another retained-history grouping and a wide
table that requires horizontal scrolling. The design records the official
PostgreSQL, OWASP and W3C sources checked in September 2026 and the alternatives.

**Next: distinguish original observation types within recent library coverage.**
Captured provenance currently includes imported membership, manual actions and
classifier results together. A high combined capture percentage cannot show
whether classifier-originated records are well represented. Use validated
original methods to expose a small fixed set of observation types, including an
explicit unknown bucket, with bounded counts and reconciliation. Preserve the
existing distinction between classifier and non-classifier capture methods;
do not infer original type from the mutable current history method. This should
help assess the available automation evidence without adding labels or controls.

Independent labels, readiness and frozen-study preflight still gate review-only
semantic counter-evidence. README, Unreleased and the preceding next item were
updated. No release, version bump, tag or production deployment is part of this
work.
