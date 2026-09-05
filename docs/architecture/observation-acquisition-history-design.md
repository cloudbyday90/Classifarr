# Automatic acquisition history design

## Decision and measurement boundaries

This document records the aggregate history design. The subsequent
[per-library extension](library-coverage-trends-design.md) adds bounded detail and
private population fingerprints while preserving the original activity counters.

Build on the [repair outcome](inventory-observation-repair-outcome.md) with two
automatic seven-day histories. Acquisition outcomes count attempts whose result
was committed through the existing source guard, separated into captured and
unavailable. Hourly coverage samples reuse the bounded observation-health reader.
Neither measure treats task completion, source placement or empty traits as proof
of classification correctness.

Outcome counts cover all inventory acquisition writes. Coverage samples describe
the first 12 active libraries by ID and at most 20,000 inventory rows, preserving
selected library IDs, excluded-library count, denominators and capacity status.
These are distinct populations. Coverage may change because inventory or library
selection changes; no causal success rate or automatic routing decision is inferred.

## Storage and atomicity

Use two small PostgreSQL tables with 168 fixed hourly slots each. A slot contains
its actual UTC hour/time; modulo addressing bounds each table to 168 rows even if
cleanup stops. A new hour replaces the slot from seven days earlier. Reads hide
expired/future slots, so stopped acquisition does not present old data as recent.
Only integer counts, selected library IDs, timestamps and fixed statuses persist.
No media identities, titles, library names, traits, provider payloads or secrets
are retained. Database constraints bound counts and library selection cardinality.
Expiry governs read visibility; unused slots can physically retain older aggregate
values until reuse, while the storage bound remains 336 rows across both tables.

Acquisition counters update in the same SQL statement as guarded metadata
persistence, and only when a provider attempt occurred and that source update
succeeded. Same-hour increments use atomic conflict updates. A later hour resets
the reused slot. Worker retries that reuse a fresh capture add no attempt.
Crashes or source drift before persistence are outside these recorded outcomes;
unavailable combines failed requests and unusable responses without guessing why.
This is committed acquisition activity, not billing or provider-request accounting.

Coverage is sampled automatically each hour and shortly after startup. Conflict
handling keeps the first sample in an hour and allows a later hour to reuse its
slot. Concurrent sampling cannot create duplicate hours or unbounded rows. Gaps
remain gaps; historical snapshots and pre-upgrade activity are not reconstructed.

## Services, API and accessibility

Small ESM modules own acquisition SQL, sample creation, bounded history reads and
scheduling. No new dependency or large singleton is needed. The authenticated,
rate-limited parameterless GET endpoint reads history only and sends `no-store`.
It neither captures snapshots nor calls providers. Database failure returns a
generic error rather than invented zero activity.

Libraries automatically loads the history with a concise summary and native
details tables. Captions, column/row headers, a polite status message and labelled
keyboard-scrollable regions keep the result accessible. Missing samples, capacity
limits, changed populations and valid empty captures stay explicit.

## Official research and August 2026 scope

The URLs below were discovered using web search and read on 5 September 2026.
The W3C recommendations and PostgreSQL 18 guidance predate the August cutoff.
OWASP is living guidance; exact August wording was not independently archived.

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  documenting quality, provenance and version history. Preserve measurement time,
  population and limitations alongside the counts.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html) specifies
  atomic conflict updates under concurrency. Use them for counter increments and
  slot reuse rather than application read/modify/write sequences.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  identifies credentials and other sensitive data to exclude. Store aggregate
  outcome categories rather than raw error strings or provider responses.
- [W3C table captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
  and [header scope](https://www.w3.org/WAI/tutorials/tables/two-headers/) support
  tables whose time periods, denominators and column relationships are explicit.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Fixed-slot aggregate history | Hard storage bound; automatic; no raw item data | Seven-day horizon and limited diagnostic detail | Implement |
| Per-item event ledger | Detailed attribution and replay | Sensitive/high-volume data, retention and deduplication complexity | Defer |
| Infer outcomes from task completion | Reuses existing records | Conflates providers and skipped/unchanged work | Reject |
| External metrics platform | Rich dashboards and alerting | Additional infrastructure and operational input | Unnecessary for this increment |

Recommended stack: guarded identity → one observation validator → bounded repair
→ automatic profiles/overlap → current health plus acquisition history → separately
evaluated classification assistance. The [outcome](observation-acquisition-history-outcome.md)
records measured results and the next task.
Semantic readiness and human-label requirements remain intact.
