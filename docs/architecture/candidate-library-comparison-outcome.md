# Candidate library comparison outcome

Date: 2026-09-07. See the separate [design and official research](candidate-library-comparison-design.md).

## Result

The statistics overview now compares validated original classifier proposals
with each retained history row's recorded library in the existing 14-day UTC
window. Five exclusive counters distinguish same library, different library,
no candidate, invalid candidate and unknown recorded library. They partition
captured classifier workflow events, including retries and superseded attempts.

Original candidate IDs are extracted only after envelope and integer validation.
Legacy rankings, mutable methods and later selections cannot replace the original
proposal. Candidate catalog removal does not erase a captured ID. Changing the
history library changes its comparison; deleting that recorded library moves a
valid proposal to unknown placement. Neither action changes the original capture.

The existing library groups remain capped at 200; global comparison totals include
omitted libraries. Strict server and client projections reject inconsistent sums,
unsafe counts and impossible known/unknown library combinations. The additive
`candidate_comparison` contract has its own client availability check, so an older
response can still display the existing observation and coverage tables.

A dedicated ESM Vue component presents a seven-column native table with scoped
headers, a distinct caption, all-library totals and keyboard scrolling. Missing
data display unavailable; an empty classifier window explicitly reports no
captured workflows. No controls, providers, schema changes, dependencies, raw
candidate exports or additional endpoints were introduced. The existing
authenticated, no-store, read-only, time-limited query boundary remains intact.

## Validation

- Focused server validation passed 107 tests across five suites.
- Focused client validation passed 51 tests across four files.
- The complete backend unit suite passed **31,136 tests across 1,091 suites**
  in 311.592 seconds using two workers with a 512 MB idle recycling threshold.
- The complete client suite passed **4,785 tests across 342 files** in
  365.77 seconds. Both complete runs passed without retries.
- PostgreSQL integration passed 66 tests across four suites. Cases cover every
  supported classifier method, malformed envelopes and IDs, legacy/forged
  rankings, lifecycle changes, inactive/deleted libraries, UTC microsecond
  boundaries and three session time zones.
- A real 201-library fixture retained the omitted library's nonzero different-ID
  count in global totals. The comparison counters for all 200 shown groups plus
  totals stayed below 32 KB. The broader 5,000-event coverage fixture completed
  in 103.443 ms in this local run; this is not a production latency guarantee.
- The browser regression passed with eight distinct tables in Pacific/Honolulu,
  expected counts, accessible headers/captions, keyboard scrolling, contrast at
  least 4.5:1, narrow reflow and zero write requests. Desktop and mobile captures
  were visually inspected.
- Server/client typechecks, scoped ESLint including new files, production
  dependency checks, ESM static-import and mock-shape checks passed.
- The new SQL and projection passed against the real local Compose database in a
  read-only transaction with a five-second statement timeout and no writes.
  It retained 6,775 history events across 11 groups. The recent window contained
  one captured imported-membership event, two unknown origins and zero captured
  classifier workflows; all comparison counters were therefore zero. Another
  6,772 events had unknown recording times and were excluded. The whole helper,
  including Docker process overhead, took 2,070 ms under concurrent test load.
  This is evidence of availability and explicit exclusions, not a classifier
  accuracy study. The new imported event also confirms the previous provenance
  writer fix on naturally arriving data.

Markdown lint and whitespace validation passed. No full coverage report or
combined coverage ratchet was generated; no endpoint was added.

## Open PR availability

GitHub MCP returned zero open pull requests at task start and final readback. A random selection
cannot be made from an empty population. No original PR was merged or substituted
with a closed PR.

## Recommendation stack and limits

Use validated immutable capture, explicit missing states, bounded PostgreSQL
filtered aggregation, strict ESM projections and an escaped native Vue table.
This provides automatic visibility into retained evidence with no operator input.
Costs are five extra counters, additional page space and unknown legacy data.
The design document compares alternatives and links the official PostgreSQL,
OWASP and W3C sources researched in September 2026.

These are observation counts, not a measured error profile or independent labels.
Same-library observations are not automatically correct; different-library
observations are not automatically errors. Readiness and frozen-study preflight
still gate review-only semantic counter-evidence. Routing behavior is unchanged.

## Next recommended item

Profile and optimize the slow inventory observation-health and overlap reads
identified in the [local Compose review](local-compose-september-review.md),
before extending the statistics surface again. Capture bounded read-only
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans and compare row estimates, execution
work and response serialization on representative inventory. PostgreSQL's
[EXPLAIN guidance](https://www.postgresql.org/docs/18/using-explain.html) explains
both actual execution measurements and their overhead/scale limitations.

Prefer a measured query improvement over speculative indexes or cached counts
that can become stale. Preserve source-identity validation, unknown states and
current freshness semantics. This improves passive library discovery without
adding maintenance controls. Provider configuration drift and bounded full-suite
worker defaults remain separate engineering follow-ups. No release is created.
