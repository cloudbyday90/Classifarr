# Automatic inventory observation repair design

## Problem and decision

The previous health assessment found a freshly timestamped observation whose
`keywords` was a JSON string. Health correctly rejected it, but refill checked only
identity headers and age, so automatic repair never reached the worker. String
IDs, noncanonical keywords and invalid language tags can produce the same drift.

Use the existing `inventoryTmdbObservationDue` and attributable observation reader
for refill decisions. SQL supplies a bounded page after enforcing operational
eligibility; it no longer tries to certify provider JSON. The worker continues to
reread source identity and apply the same validity check before acquisition.

## Bounded traversal

Each refill reads at most 5,000 rows and enqueues at most that many tasks. Supported
types and active pending/processing task exclusion apply before the limit. The
observation branch requires an active library, positive TMDb ID, active nonblank
provider configuration and the existing six-hour attempt cooldown. Standard
enrichment keeps its existing eligibility and shares the page budget.

Pages use increasing immutable item IDs, replacing attempt-time priority. The
long-lived refill service retains the last scanned ID and the inventory maximum
ID captured when a pass starts. Rows are advanced even when all observations are
fresh. A short or empty page finishes the pass; the next cycle starts again.
New insertions wait for the next pass, so they cannot indefinitely delay wrapping
to earlier IDs. No OFFSET, unbounded loop or full-inventory application read is
introduced. Bounds limit returned rows, not database execution time or byte size.

The cursor is an optimization, not durable truth. Process restart begins a new
pass; frequent restarts can delay later pages. Failed reads leave progress intact;
failed enqueue rolls back the in-memory checkpoint and existing queue exclusion
skips tasks already accepted on retry. Concurrent refill calls in one service
share one in-flight operation through enqueue completion. Cross-process task
deduplication remains the existing queue's responsibility.

## Validity and security

Freshness uses the SQL statement's observation time and stored attempt/fetch
clocks. Full validation covers numeric version and identity, exact movie/TV type,
bounded keyword arrays, canonical Unicode strings, and canonical language or
explicit null. Empty keywords with null language are valid captures, not failures.
Malformed or missing observations are repairable after cooldown regardless of a
recent fetch timestamp. Future fetch timestamps are not treated as fresh; future
attempt timestamps retain cooldown protection.

All cursor and time values use bound parameters and fixed SQL identifiers. No
provider JSON is cast to a SQL numeric type or executed. Selection is read-only;
existing provider limits, source-guarded writes and observation-only tasks perform
repair. No new endpoint, credential exposure, manual repair flow, semantic routing
or classification authority is added.

## Official guidance and August 2026 scope

Sources were discovered with web search and read on 5 September 2026. PostgreSQL
18 and the dated W3C note predate the requested August cutoff. OWASP is living
guidance; this is a current reading of established practices, not a verified
archival snapshot of its exact August wording.

- [PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)
  distinguish JSON-preserving extraction from text extraction. Text equality
  cannot establish the original JSON type; JSON path error suppression also does
  not prove semantic validity.
- [PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) calls
  for unique ordering of bounded results. The fixed ID traversal makes each page
  deterministic within its statement snapshot.
- [PostgreSQL indexes and ordering](https://www.postgresql.org/docs/18/indexes-ordering.html)
  explains how ordered B-tree scans can support LIMIT. An ID range permits this
  access path; actual plans and filtering cost still depend on the inventory.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends syntactic and semantic validation, including untrusted backend
  sources. Reusing the reader prevents acquisition from accepting weaker evidence.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) separates quality
  dimensions, measurements and provenance. This Working Group Note informs our
  distinction between valid capture, known traits and freshness; it is not a
  claim of vocabulary conformance or classification accuracy.

## Alternatives and final recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Shared JS validation with bounded traversal | Exact reader parity; no schema change or routine input | Fresh rows consume reads; later pages wait for cycles | Implement |
| Full SQL semantic validator | Filters invalid records before transfer | Duplicates Unicode/ICU language rules and risks drift | Reject here |
| Filter one fixed first page in JS | Small patch | Fresh rows can indefinitely hide later repairs | Reject |
| Persist validated state and repair cursor | Faster large-inventory scans and restart continuity | Migration, invalidation and validator-version lifecycle | Revisit with measurements |

Recommended stack: guarded inventory identity → one attributable observation
validator → bounded automatic repair → automatic profiles and typed overlap →
coverage/freshness health → independently evaluated classification assistance.
Human review and frozen-study readiness contracts remain separate from inventory
observations. The [outcome](inventory-observation-repair-outcome.md) records results
and the next task.
