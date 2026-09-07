# Evidence method attribution design

Date: 2026-09-07. Research checked on this date, within September 2026.

## Problem and decision

Clarification resolution overwrites `classification_history.method` with
`manual_classification`. The previous capture change preserves the original method
and candidate source in `classification_details.candidate_capture`. Report those
facts alongside the current recorded method, automatically. A recorded method can
belong to pending history, so calling every recorded method a final outcome would
be misleading.

Add `history_attribution` to the existing `evidence.coverage.v2` overview payload.
Keep the existing recorded-library history and selected-library feedback views.
Group the same retained history by recorded library, original method, candidate
source, recorded method and provenance status. Limit displayed groups to 200 with
stable ordering; compute totals over every group. These are alternate views of
the same events and must never be added together.

Only a validated v1 pre-routing capture can establish original method or source.
A valid capture of an invalid candidate still establishes provenance; malformed
capture does not. Distinguish captured, missing, unsupported and invalid provenance.
Legacy rankings may establish candidate availability but cannot recover original
method. Never backfill it from the current method or selected library. Share
capture envelope validation rules between both SQL projections.

## Architecture and security

Use small ESM SQL and projection services, the existing named client API, and a
small Vue table component. A single read-only SQL statement provides coherent
history, attribution and feedback populations, with the existing five-second
timeout. Validate safe integer counts, exclusive partitions, bounded groups and
agreement with history totals. Project only aggregate dimensions and counts;
exclude raw metadata, media IDs, titles and prompts. No endpoint, schema migration,
provider request, routing change or operator annotation is needed.

The client uses escaped text, a native caption, row/column headers and a labelled
keyboard-scrollable region. Missing attribution in older payloads is unavailable,
not zero. Counts describe provenance availability, not accuracy or human review.

## Official research and tradeoffs

| Recommendation | Benefits | Costs / limits | Official source |
| --- | --- | --- | --- |
| Keep original provenance separate from later activity | Preserves the distinction between a generated proposal and its subsequent resolution | Cannot reconstruct missing history; this is domain JSON, not an RDF implementation | [W3C PROV-O](https://www.w3.org/TR/prov-o/) |
| Use one statement for all aggregate views | Shared PostgreSQL command snapshot; fewer round trips | Query work grows with retained history; measure locally before adding indexes | [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html) |
| Native tables with captions and scoped headers | Explicit relationships for assistive technology and keyboard users | Wide data requires local horizontal scrolling | [W3C captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/), [two headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) |
| Fixed SQL expressions and bound limit | Request input cannot construct SQL identifiers or expressions | Validation of stored JSON is still required | [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) |

Inferring original method from current method would fill more rows but produce
false attribution after manual resolution. A new audit-event schema could capture
every transition, at the cost of migrations, retention rules and extra writes.
Neither is required for the existing immutable capture.

Final recommendation stack: immutable capture JSON, shared strict SQL validation,
bounded aggregate projection, existing authenticated overview API, and native Vue
table semantics. Continue collecting passive evidence before considering changes
to feedback evaluation or the independently reviewed semantic study gates.

## Validation plan

Exercise real PostgreSQL with original/current method divergence, all capture
sources and statuses, malformed and legacy evidence, empty populations and capped
groups. Check API redaction and totals, client fallback and escaping, keyboard and
mobile layout, existing router guards, and a disposable Docker build/schema check.
Measure the read-only query against local Compose without rewriting its history.

The randomly selected [PR #527](https://github.com/cloudbyday90/Classifarr/pull/527)
is adopted as its exact package/lock patch, without merging that PR. The official
[upstream fix](https://github.com/vuejs/router/commit/92cfd6f4f3dd529376704eb3b8575309d2418317)
handles non-string parameters in active links; stable application navigation and
auth guards remain the relevant local regression targets. See the separate
[router outcome](vue-router-527-outcome.md) and [implementation outcome](evidence-method-attribution-outcome.md).
