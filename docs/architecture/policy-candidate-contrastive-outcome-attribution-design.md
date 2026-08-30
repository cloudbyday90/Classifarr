# Policy Candidate Contrastive Outcome Attribution Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

The exact-TMDb cross-library check is intentionally advisory. Its most useful
next question is therefore empirical: when its fixed status is present, does a
later validated operator action confirm the leading candidate, choose another
bounded candidate, or select outside the original policy candidate set?

This design records that answer without retaining a media, candidate, library,
destination, operator, provider, prompt, response, or free-form rationale.
It is independent of the earlier current-library lexical-retrieval attribution:
that component applies only where that retrieval telemetry exists, while the
exact contrastive check applies to pending confirmation and selection flows.

## Attribution Contract

The persisted `policy_candidate_contrastive_outcome_attribution` contains only:

- `version` (`policy.candidate_contrastive_outcome_attribution.v1`);
- `contrastive_status_id`, one of the six fixed observable cross-library
  results; and
- `selection_status_id`, one of `confirmed_candidate`,
  `changed_to_candidate`, `changed_outside_candidates`, or
  `routed_not_applicable`.

It is created only after both conditions hold:

1. the existing persisted contrastive evidence validates against its strict
   version/provenance/status projection; and
2. the fingerprint-bound runtime-question answer has been validated by the
   server against its candidate set.

Candidate and selected-destination IDs are used only while the server derives
the fixed selection status. The persistence boundary rebuilds the two-axis
allow-listed object, so raw input cannot become telemetry.

## Architecture

```text
persisted exact contrastive status + validated runtime-question answer
  -> shared server-side candidate-set outcome reduction
  -> contrastive outcome-attribution projection
  -> classification history metadata (fixed IDs only)
  -> static aggregate SQL over complete UTC days
  -> authenticated read-only metrics endpoint
  -> client allow-list + native accessible data table
```

The generic completed-UTC-day window module also removes an accidental
dependency on the current-library retrieval domain from the shared 1–30-day
observation-window rule.

## Aggregate Report

The report always returns the same six fixed contrastive buckets:

- leading identity match;
- alternative identity match;
- shared identity match;
- no candidate identity match;
- identity unverified; and
- retrieval unavailable.

Each bucket contains only count fields: checks observed, resolved outcomes,
attributed outcomes, confirmation of the leading candidate, change to another
bounded candidate, selection outside the candidate set, not-applicable route,
and derived rates. The endpoint never returns rows, names, IDs, timestamps,
catalog text, AI data, or actor information.

`changed_to_candidate` and `changed_outside_candidates` are observations of a
validated operator action, not proof that the cross-library status caused the
action. Only the latter is a policy-candidate-set review signal; neither
authorizes a route or a model call.

## Research Basis

- NIST's Generative AI Profile treats provenance tracking and structured
  evaluation as lifecycle risk-management inputs. Retaining a fixed source
  status and later bounded human outcome supports evaluation without promoting
  either signal to routing authority. [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
- OpenTelemetry explains that metric cardinality grows with unique attribute
  combinations and cautions against user IDs, raw paths, and other unbounded
  fields. Six status buckets and four fixed outcomes avoid that problem.
  [OpenTelemetry Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- OWASP recommends excluding sensitive data from logs and using data
  minimization/de-identification when identity is not required. This design
  computes membership transiently and persists aggregate-safe facts only.
  [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- PostgreSQL supports aggregate filters, which allow the static query to count
  fixed outcome categories without fetching telemetry rows into application
  memory. [PostgreSQL aggregate `FILTER`](https://www.postgresql.org/about/featurematrix/detail/filter-clause-for-aggregate-functions/)
- W3C recommends native HTML tables where possible, with programmatic header
  relationships, and a polite status message for nonurgent updates. The view
  uses a native table with `scope` headers and an atomic `role="status"`
  announcement. [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/),
  [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse current-library retrieval attribution | Minimal code | Excludes confirmation flows without lexical-retrieval telemetry and mixes distinct evidence domains | Reject |
| Persist destination and candidate identities for analysis | Flexible drill-down | Enlarges retention, access, and cardinality surface | Reject |
| Browser-submitted telemetry bucket | Simple client code | Untrusted and can diverge from the resolved server contract | Reject |
| Server-derived fixed two-axis attribution with aggregate report | Precise enough to evaluate the check, low cardinality, reusable, privacy-bounded | No individual drill-down and requires new observations | Adopt |

## Security and Accessibility Controls

- Attribution runs after server validation; no request accepts a status or
  telemetry payload from the browser.
- The shared reducer accepts only two or three valid candidate destinations and
  four fixed action IDs.
- The outcome service removes transient attribution data from the mutable
  outcome path and retains only its validated projection in classification
  details.
- The repository uses one parameterized, read-only aggregate query bounded to
  complete 1–30 UTC-day windows and fixed status vocabularies.
- The endpoint is behind the existing statistics authentication middleware and
  exposes no row-level query parameters or identities.
- The client discards unknown versions/statuses and uses client-owned labels and
  messages. It presents a semantic, noninteractive native table; no focus move,
  auto-route, policy action, retry, learning command, or AI request is added.

## Final Recommendation Stack

1. Collect this aggregate-only attribution until the real operator cohort is
   representative; do not infer causation from isolated decisions.
2. Review `alternative_identity_match` changed-selection and outside-candidate
   rates first. A high outside-candidate rate is a deterministic policy-candidate
   scope/ranking question, not an AI or RAG conclusion.
3. Add replay fixtures from resolved Katrina-like documentary cases before
   changing policy weights or adding semantic retrieval.
4. Consider a bounded semantic/RAG evaluation only if a representative cohort
   shows a repeatable unresolved gap after policy candidate scope, exact identity,
   and deterministic evidence have been reviewed.
