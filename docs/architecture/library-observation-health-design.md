# Library observation health design

Date: 2026-09-05. Status: implemented and locally verified; see the separate
[outcome](library-observation-health-outcome.md).

## Problem and decision

Library overlap now exposes incomplete metadata, but cannot explain whether the
current inventory has never been observed, has aged out, or is waiting between
attempts. Add an automatically loaded, read-only health summary on Libraries.
Reuse current inventory, attributable TMDb records, persisted observation clocks
and active metadata-enrichment tasks. Do not add per-item operational input,
provider requests, queue writes, new schedules or classification authority.

## Measurement contract

`GET /api/libraries/observation-health` returns a versioned aggregate snapshot of
at most 12 active libraries, ordered by ID, and 20,000 inventory rows. A sentinel
row detects overflow and withholds all sampled counts. Excluded active libraries
and unsupported media types are explicit. Empty libraries remain visible.

This population is inventory rows because clocks and tasks belong to source rows.
It differs deliberately from overlap's distinct-identity denominator. Show known
typed IDs against supported rows; keyword and language coverage against identified
movie/TV rows. Reuse `readInventoryTmdbObservation` to reject wrong identities,
legacy guesses, malformed languages and invalid keyword records. A valid empty
keyword list is a successful capture without known keyword coverage; null language
likewise remains unknown. The read never guesses English or promotes source tags.

Each row occupies exactly one acquisition state, in this order:

| State | Meaning |
| --- | --- |
| Unsupported type | The source row is neither movie nor TV |
| Missing identity | A supported row lacks a valid TMDb ID |
| Observation withheld | The projected observation exceeds the 4,096-byte read budget |
| Clock anomaly | A persisted clock is invalid or in the future relative to the database snapshot |
| Fresh | An attributable observation has a successful timestamp less than 30 days old |
| Backoff | A non-fresh row was attempted less than six hours ago |
| Never observed | No attributable record and neither observation clock exist for this current source |
| Due | Remaining identified rows have no fresh reusable observation |

Use the existing cache/retry constants, and one database statement time for all
comparisons. Exact 30-day and six-hour boundaries are due. An undated but valid
observation can supply coverage while its freshness remains unverified. Invalid
records, undated captures, empty keywords, unknown language, and attempts without
a later successful capture are separately counted; these counts can overlap the
partition. Attempts alone never establish a provider failure reason or success.

Latest and oldest successful times require both attributable records and valid,
nonfuture fetched clocks. They describe retained current-source observations,
not a permanent historical audit. Source replacement can reset those clocks.

Queue activity is separate: count rows linked by canonical `payload.itemId` to
pending/processing `metadata_enrichment` tasks, with processing precedence and no
duplicate-task inflation. Other task types, terminal history and legacy aliases
are outside this measure. Tasks can include other providers or await stale-source
guards; their presence does not guarantee that TMDb will be called or succeed.
Expose only whether an active TMDb configuration has a nonempty key, never the key.
Freshness eligibility does not claim scheduler selection or completion.

## Architecture, security and accessibility

Separate ESM query, row-state measurement and aggregate-service modules; a small
authenticated route invokes them. The fixed, parameterized SQL performs one
snapshot read, projects only observation fields and clocks, and aggregates queue
activity before returning bounded rows. Database statement timeouts remain active.
Physical scans may exceed the returned row bound; query timeouts bound database
execution. No schema or dependency change is required.

Reject query parameters, send `Cache-Control: no-store`, and limit this endpoint
to 30 authenticated reads per IP per 15 minutes with the existing rate-limit
library. Return aggregate library identifiers/names and counts, not media IDs,
titles, paths, provider payloads, credentials or error details. Database failures
stay unavailable, rather than becoming apparently healthy empty observations.

The client named GET helper feeds separate summary and per-library detail
components. Show coverage and freshness automatically; native disclosures expose
the state explanation and queue context. Use escaped text, semantic table captions
and scoped headers, keyboard-focusable scroll regions, readable mobile widths,
polite result status and an error retry. Loading a summary performs no mutation.

## Official research and tradeoffs

URLs were discovered through tool-backed web search or links from official pages,
then read on 2026-09-05. Established guidance predates the requested August 2026
baseline; living PostgreSQL/OWASP pages are current reads, not archived August copies.

| Source | Applied recommendation |
| --- | --- |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) and [Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) | State observation freshness, completeness, provenance and missing-data limits; expose quality measurements without adopting RDF. DQV is a Working Group Note. |
| [W3C table captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Associate counts with headers/captions, expose dynamic statuses, and support keyboard access and readable mobile presentation. |
| [PostgreSQL date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | Use statement time consistently instead of application clock drift or changing wall-clock time during a measurement. |
| [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | Authenticate the endpoint, constrain inputs and resource use, and omit sensitive data/errors. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded current-source summary | Automatic, deterministic, low operational input; explains unknowns | Explicit population bounds and no historical trend | Implement now |
| Infer capture from generic enrichment completion | Cheap | OMDb/web-search success does not prove attributable TMDb traits | Reject |
| Persist health/trend snapshots | Supports convergence and regression trends | Additional retention, schema and lifecycle work | Consider after current measurements |
| Repair items on reads or request manual labels routinely | Could fill selected gaps | Side effects, provider costs and operator burden | Keep separate from observation reads |

Recommended stack: guarded inventory → attributable metadata → automatic profiles
→ typed overlap → automatic coverage/freshness health → independently evaluated
classification assistance. Existing readiness and frozen-study gates remain intact.

## Validation plan

Test exact cache/retry boundaries, wrong movie/TV identities, valid empty captures,
missing/future clocks, unknown and withheld metadata, queue deduplication, empty
and inactive libraries, bounds, authentication, rate limits and read failures.
Run the query in PostgreSQL under read-only settings; measure real Compose
inventory privately and exercise acquisition convergence with controlled provider
responses. Record actual results and the next concrete issue in a separate outcome.
