# Automatic library scan diagnostics design

## Decision

Derive completion and restart diagnostics from the existing bounded history GET.
Do not add a scheduler, provider call, mutation endpoint or storage table. Reuse
the seven-day window and 2,016 retained visit slots, with a separate ESM projection
service and small presentation components.

## Measurement contract

Only v3 visits count as incremental scan evidence. Retained v2 visits remain
visible as legacy history. For each library with retained visits, report the
first/last incremental visit, completed measurements, partial visits, discarded
visits, recorded restart reasons and last completion/measurement times. Completed
scan duration is completion time minus its measurement baseline. Do not divide
completions by visits to imply a success rate: larger libraries require more pages.

A restart is a visit with an explicit restart reason other than
`changed_before_write`. A discarded visit has status `invalidated`; it does not
prove that the next scan restarted. Keep those counts separate. Counters since
the last retained completion reset on a complete visit, including a visit that
both restarts and completes. A repeated-reset finding means at least two recorded
restarts or discarded visits since that completion, or in the retained window
when there is no completion. Expiration is reported separately from other reasons.
These are descriptive findings, not outage predictions or remediation triggers.

Report elapsed time since the first retained unresolved visit with that exact
meaning. It is not continuous processing time: interruptions and unrecorded
periods remain possible. No retained completion means none in the visible window,
not that the library has never been measured. A retained completion does not
prove current coverage, fresh metadata, identity correctness or AI readiness.

## Catalog scope and query cost

The same SQL statement joins retained visits to current library activity and
counts active libraries with/without incremental visits and completed scans.
Provide the first 12 active library IDs without incremental visits and an explicit
remaining count. Names stay in the existing library catalog response.

Diagnostics read at most 2,016 visit rows plus the library catalog; catalog counts
cost work proportional to library count. They never scan media inventory or
progress rows. Current catalog totals are distinct from the active count recorded
at the last background visit. Deleted/inactive library history stays identifiable
and cannot be prioritized as an active unresolved library.

The additive `scanDiagnostics` contract has its own version and explicit window
boundaries. It does not change sampling v3, existing points or legacy projections.
Only allowlisted counters, library IDs, statuses and times leave the server.
Revisions, item cursors, digests, names, raw metadata and provider details remain
excluded. Authentication, rate limiting, query-parameter rejection, generic
errors and `no-store` remain on the existing route.

## Presentation

Show an automatic overview of active libraries with retained complete measurements,
without complete measurements and without incremental visits. Identify bounded
unvisited examples using current escaped names. Prioritize active libraries with
repeated resets, then expirations, then no retained completion; use library ID
as the deterministic tie-breaker. Retain local 12-library pagination.

Per-library details explain the finding, counts, observation span, last completed
measurement and recorded restart reasons. Ordinary progress is not an error.
Existing loading and pagination status messages remain programmatically marked;
static findings do not become an alert for every library. Native disclosures and
table semantics remain available without additional requests or manual collection.

## Official research and August 2026 scope

URLs were discovered through search and read on 6 September 2026. The established
PostgreSQL 18 and W3C guidance predates the requested August baseline; living pages
are not claimed to be archived August snapshots.

- [PostgreSQL aggregate functions](https://www.postgresql.org/docs/18/functions-aggregate.html)
  documents explicit aggregate ordering, empty-input behavior and count cost.
  Aggregate the already bounded visits and disclose catalog-count cost.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  quality, provenance and version information. Publish explicit observed windows
  and distinguish absent evidence from a measured failure.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains programmatic status announcements and the risk of excessive live
  announcements. Reuse existing loading status and native disclosures.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Derive diagnostics from retained visits | No collection setup; bounded work; existing provenance | Limited historical window and no causal certainty | Implement |
| Add a second monitoring scheduler | Independent measurements | Duplicate state and lifecycle complexity | Defer |
| Classify missing completion as a failure | Simple alarm | Confuses ordinary paging, new libraries and missing history | Reject |
| Automatically change scan or routing policy | Could reduce delays | Recovery strategy lacks measured evidence | Defer |

Recommended stack: synchronized inventory → observation revisions → automatic
profiles → fair incremental measurement → completion/restart diagnostics →
evidence-backed recovery → independently evaluated review-only semantic evidence.
Readiness and frozen-study gates remain unchanged.
