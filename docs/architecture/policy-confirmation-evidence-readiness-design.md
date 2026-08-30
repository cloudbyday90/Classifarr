# Policy Confirmation Evidence Readiness Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will extend current-library Candidate Retrieval Monitoring with a
bounded, aggregate **Policy confirmation evidence** report. It measures the
fixed deterministic evidence categories present on the leading candidate for
recent policy-confirmation outcomes. Its purpose is to identify whether a
representative confirmation cohort is repeatedly missing specialized declared
scope evidence before an administrator changes policy scope, eligibility, RAG,
or AI behavior.

The report is observational only. It cannot identify an item, policy, library,
operator, provider, model, prompt, response, candidate, or route. It cannot
call AI, alter a policy, learn, retry work, or route media.

## Research Basis

- NIST's AI RMF Measure function calls for documented, repeatable production
  monitoring, including metrics meaningful in deployment context that feed risk
  management rather than silently changing a system. The report therefore uses
  explicit cohort thresholds and advisory outcomes only.
  [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP recommends returning only explicitly chosen response properties and
  keeping API responses to the functional minimum. The endpoint returns fixed
  aggregate counters rather than serializing history or policy candidates.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- OpenTelemetry's Metrics SDK specifies hard cardinality limits for unique
  attribute sets. This design has no caller-selected dimensions and a fixed
  evidence vocabulary, so it cannot become a title, policy, library, or model
  telemetry index. [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
- W3C WCAG 2.2 requires programmatically determinable status messages for
  meaningful asynchronous updates without needlessly interrupting the user.
  The existing polite, atomic monitoring announcement will include the new
  aggregate readiness state. [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages/)
- W3C ARIA22 recommends `role="status"` with explicit `aria-atomic="true"`
  where the full update provides necessary context. No alert, focus move, or
  live update is added for static explanatory detail.
  [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)

## Data Model

The existing metrics repository reads one bounded UTC-day aggregate over
classification-history rows with current-library retrieval telemetry. For rows
whose persisted primary route-safety gate is `policy_confirmation_required`,
it counts only these leading-candidate facts:

- declared evidence mode: `identity`, `compatibility`, or absent;
- four supporting evidence booleans: observed profile, learned pattern, RAG,
  and prior outcomes; and
- whether the existing evidence-safety calibration was applied.

The static SQL never returns the JSON object, IDs, titles, policy terms,
destinations, providers, prompts, responses, exact durations, or actors. The
HTTP response contains only a fixed version, counts, rates, thresholds, and
allow-listed status IDs.

## Readiness Rule

`current_library.policy_confirmation_evidence_readiness.v1` uses a completed
UTC-day observation window and requires 20 confirmation observations before it
can suggest maintenance. With sufficient data, it recommends reviewing
declared policy scope only when specialized declared evidence appears on fewer
than 60% of those leading candidates. Supporting-source and calibration rates
are contextual only: a new or intentionally narrow library can legitimately
lack historical, profile, pattern, or RAG support.

This is a maintenance signal, not an accuracy metric or an authorization
threshold. A recommended review means: inspect representative individual score
explanations, then strengthen or narrow declared policy purpose only when the
evidence supports doing so.

## Alternatives

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Per-policy or per-library analytics | Pinpoints a configuration immediately | Reveals identities and creates high-cardinality telemetry | Reject |
| Make missing RAG/history automatically increase AI use | May produce more model activity | Confuses evidence absence with correctness and changes authority | Reject |
| Return complete persisted candidate diagnostics | Convenient for future UI detail | Exposes internal schema and potentially sensitive fields | Reject |
| Fixed aggregate confirmation evidence readiness | Actionable, private, repeatable, and authority-safe | Requires score-explanation review before editing policy | Adopt |

## Security And Authority Boundaries

- The query is static and parameterized only by the server-built UTC range and
  fixed internal contract versions/gate ID.
- Evidence categories are allow-listed by a pure ES module. Malformed,
  negative, or oversized counts fail closed to zero and cannot create a status
  or response property.
- The browser maps status and source labels locally and ignores server-supplied
  display text. An unknown status is unavailable.
- The response retains endpoint authentication and has no input to select a
  policy, item, library, provider, model, or telemetry dimension.
- The UI has no mutation control and does not expose item-level aggregates.

## Final Recommendation Stack

1. Use individual deterministic score explanations to understand a pending
   confirmation such as `71/100`.
2. Watch the aggregate Policy confirmation evidence cohort until it reaches 20
   completed-window observations.
3. If specialized declared evidence remains below 60%, inspect a representative
   set of explanations and refine policy purpose, scope, or eligibility.
4. Use candidate-set readiness alongside this report: broaden candidate scope
   only when outside-candidate outcomes support it.
5. Consider new semantic/RAG retrieval or wider AI participation only after
   declared scope and candidate-set evidence have been evaluated.
