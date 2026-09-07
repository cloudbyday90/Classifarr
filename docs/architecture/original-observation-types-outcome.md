# Original observation types outcome

Date: 2026-09-07. See the separate [design and research](original-observation-types-design.md)
and [local Compose/release review](local-compose-september-review.md).

## Result

The library UTC overview now separates imported membership, manual actions,
classifier workflows and unknown origins using validated original methods. Four
counts partition each library's existing window and the uncapped global window.
The same 200-group limit applies; no library-by-type row explosion occurs.
Known-type counts cannot exceed captured provenance, and capped row sums cannot
exceed global type totals. Missing and inconsistent data display unavailable.

New source-library and manual queue history use a shared ESM metadata builder to
record their fixed original methods with `not_applicable` candidate status. Caller
capture data cannot override the current writer's origin. Existing metadata is
preserved without mutation, source identity guards remain intact, and later
resolution does not relabel original provenance. Existing rows stay unchanged.

The native Vue table has six scoped columns, row headers, a distinct caption,
all-library totals and keyboard scrolling. Ordinary prose describes the UTC
window, unknowns and interpretation limits. No endpoint, operator control,
provider call, migration, automatic routing or independent label was introduced.
Classifier workflows include retries/fallbacks; manual actions are not blinded
review labels; imported placements are not independently verified truth.

## Validation and local findings

- Initial focused validation passed 144 server unit tests and 80 client tests.
- PostgreSQL coverage includes every supported original method, missing/invalid/
  unsupported envelopes, valid no-candidate and invalid-candidate captures,
  UTC microsecond boundaries, session-zone independence, library removal,
  resolution and the actual 201-library truncation case.
- The expanded release review passed 300 integration tests across 17 suites;
  the final source/manual writer and identity recheck passed another 14 tests
  across five suites, some overlapping the earlier set.
- After fixing the transport mock setup, actual log routing and source/manual
  writers, focused runtime-fix/code-health validation passed 21,122 tests.
- The full client run passed 4,760 tests with one router timeout; stubbing eager
  page trees in the guard test preserved real navigation and all 12 router tests
  then passed. The full backend serial run exceeded its default heap; see the
  release review for the bounded worker alternative and final run outcome.
- The complete backend rerun passed **31,097 tests across 1,090 suites** in
  205.567 seconds with `--maxWorkers=2 --workerIdleMemoryLimit=512MB`. This uses
  normal process workers and recycles them between files.
- The browser regression passed in Pacific/Honolulu with seven native tables,
  unchanged UTC labels, keyboard scrolling, contrast checks, narrow reflow and
  no write requests. Desktop and narrow captures were visually inspected.
- A no-cache Compose build passed fresh schema comparison and the live upgrade
  preserved retained data. Authenticated HTTP/browser checks exposed missing
  source-writer provenance and suppressed Pino transport logs, both corrected
  with real regression tests. Numeric log levels retain severity filtering and
  redaction. Details and limitations are in the separate release review.
- Both typechecks, scoped ESLint, production dependency checks, ESM static-import
  and mock-shape checks, migration integrity, Markdown lint and whitespace checks
  passed.

No full coverage report or combined coverage ratchet was generated; no endpoint
or dependency was added. The data and tests do not measure classification error.

## Open PR availability

GitHub MCP returned zero open PRs at task start and final readback. No random selection was possible
from an empty population, and no original PR was merged.

## Recommendations and next item

Recommended stack: validated original capture, fixed taxonomy, bounded PostgreSQL
filtered counts, strict modular ESM projection, and an escaped native Vue table.
This makes evidence composition visible without operator input. Costs are four
additional counters, more vertical page space and unknown legacy origins.
Official PostgreSQL, OWASP, W3C, Docker and Pino sources and alternatives are
recorded in the linked documents.

**Next product item: compare original candidate libraries with recorded libraries
for recent classifier workflow observations.** Keep unknown/no-candidate states
explicit and use immutable captured candidate IDs, not current placement as
ground truth. Bounded agreement/disagreement counts would reveal what evidence
exists for later evaluation; disagreement is not itself a measured error.

**Next engineering item: make bounded worker recycling standard for full local
backend tests**, using the measured rerun to choose defaults. Independent labels,
readiness and frozen-study preflight continue to gate review-only semantic
counter-evidence. No release, version bump or tag is part of this work.
