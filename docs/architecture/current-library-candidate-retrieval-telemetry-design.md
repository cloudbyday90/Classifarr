# Current-Library Candidate Retrieval Telemetry Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will measure the bounded current-library lookup with a fixed,
content-free telemetry projection persisted on the existing classification
history row. A read-only aggregate endpoint and Statistics tab expose lookup
availability, fixed latency bands, catalog-match presence, and the agreement
between a bounded AI proposal and a later operator destination.

This is an evaluation component, not a scoring, learning, routing, or model
control component. It does not make the AI more authoritative.

## Research Basis

- The OpenTelemetry data model treats histograms as compressed measurement
  populations and supports spatial reaggregation to remove unwanted
  attributes. Fixed latency bands and no identity-bearing dimensions apply
  those properties to this local aggregate report. [OpenTelemetry Metrics Data
  Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- OpenTelemetry’s SDK specification calls out cardinality limits; a fixed
  status and five latency-band values avoid per-title, per-library,
  per-provider, and per-model metric series. [OpenTelemetry Metrics
  SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
- OWASP recommends sanitizing event data and avoiding sensitive material in
  logs. This design records no event text at all and revalidates the fixed
  persistence projection. [OWASP Logging Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- The Statistics view uses `role="status"` for loading/readiness changes and
  `role="alert"` for errors, consistent with W3C guidance for non-focus-moving
  status updates. [W3C WCAG 2.2, Status
  Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Options Considered

| Option | Benefits | Costs / Risks | Decision |
| --- | --- | --- | --- |
| Fixed telemetry projection on retained history rows | One transactionally related record, no new event store, content-free aggregate query | New data appears only after upgrade and classification | Adopt now |
| New raw event table | Precise timing and arbitrary drill-down | Duplicates item-level events, increases retention and access-control surface | Reject |
| Direct external telemetry export | Standard ecosystem integration | Requires a collector, credentials, deployment policy, and additional data-flow review | Defer |
| Whole-library embedding lifecycle first | May improve semantic recall | Cost, backfill, deletion, poisoning, retention, and evaluation complexity remain unmeasured | Reject for now |

## Telemetry Contract

`current_library_candidate_retrieval_telemetry` is written only when the
server-owned candidate lookup actually runs. It contains exactly:

- version;
- `available` or `unavailable` status;
- one fixed latency band: under 25 ms, 25–99 ms, 100–249 ms, 250–999 ms, or
  1,000 ms or more;
- bounded candidate count, candidates with any catalog match, and candidates
  with a direct identifier/title-year match.

It deliberately excludes title, year, TMDB ID, library ID/name, query terms,
catalog results, profile evidence, RAG titles, prompt, provider, model, AI
response, actor, and exact elapsed duration.

The persistence service rebuilds an allow-listed snake_case projection before
writing it. Invalid runtime telemetry is dropped rather than repaired.

## Aggregate Metrics

The authenticated read-only endpoint is:

`GET /api/stats/current-library-candidate-retrieval?days=1..30`

It only scans completed UTC days and returns one aggregate report:

1. Retrieval health: lookup count, availability, observations with a catalog
   match, and observations with a direct match.
2. Latency distribution: counts and percentages for the five fixed bands.
3. AI/operator agreement: bounded AI proposals, proposals later resolved by an
   operator, same-destination selections, alternatives, and unresolved
   proposals.

Agreement is intentionally narrowly defined: the eventual recorded operator
destination equals the previously persisted bounded AI proposal. It is not a
correctness rate, a confidence score, evidence that retrieval caused the
choice, or authorization to auto-route.

The query uses the most recent final destination from the existing outcome
path, so a later operator correction supersedes an earlier selection. It
returns no row identity or source content. A partial `created_at` index is
added only for rows with this telemetry version.

## Data Flow

```text
server-owned candidate contract
  -> bounded read-only catalog lookup
  -> fixed telemetry projection
  -> classification history metadata
  -> aggregate SQL (completed UTC days)
  -> authenticated Statistics API and accessible read-only view
```

The AI receives existing provider-projected evidence only. Telemetry does not
enter the prompt and cannot affect candidate eligibility, AI invocation,
policy score, policy learning, or routing.

## Security Controls

- Candidate count and latency-band vocabulary are compile-time bounded.
- The projection has no user- or media-controlled string field.
- SQL is static and parameterized; the endpoint accepts only a bounded day
  window.
- The aggregate query returns no destination/library identity, raw provider
  metadata, or prompt/model text.
- Metrics failures remain read-only request failures; no classification result
  is altered or retried because reporting is unavailable.
- The UI explains the limit of agreement and has no action that changes a
  policy or route.

## Recommendation Stack

1. Deploy this aggregate telemetry and collect a realistic operator-reviewed
   cohort.
2. Add the separate
   [outcome-attribution design](current-library-candidate-retrieval-outcome-attribution-design.md)
   so an alternative selection can be distinguished from a true
   outside-candidate choice before assigning a cause to retrieval.
3. Compare latency bands, retrieval availability, catalog-match presence,
   agreement, and candidate-set attribution before changing retrieval
   architecture.
4. Consider a versioned, partitioned embedding lifecycle only after explicit
   provider, cost, retention, deletion, poisoning, and offline-evaluation
   decisions.

## Open Pull Request Check

The GitHub Pull Requests API returned zero open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There was therefore no available PR
to implement locally without fabricating a selection.
