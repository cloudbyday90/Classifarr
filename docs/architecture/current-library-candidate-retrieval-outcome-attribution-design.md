# Current-Library Candidate-Retrieval Outcome Attribution Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will add a fixed, content-free outcome-attribution projection when
an operator resolves a current-library candidate-retrieval decision through a
fingerprint-bound, server-validated runtime-question contract. The projection distinguishes a confirmed
bounded candidate, a broader chooser selection that still lands on a
candidate, a broader chooser selection outside the candidate set, and a
not-applicable resolution.

This makes the retrieval telemetry actionable: an outside-candidate selection
is evidence that the bounded policy candidate set needs review. It is not proof
that lexical retrieval failed, and it is never a reason to auto-route or
change policy learning.

## Research Basis

- NIST's Generative AI Profile calls for structured user-feedback mechanisms
  and for using feedback to assess AI output impact. The projection is a
  structured, bounded record of the operator's action rather than model
  reasoning or free-form feedback. [NIST AI RMF: Generative AI
  Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- OpenTelemetry explains that metric cardinality grows with unique attribute
  combinations; user IDs and raw paths can cause unbounded growth. A four-value
  status vocabulary avoids per-item, per-library, and per-operator metric
  dimensions. [OpenTelemetry Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- OWASP's current LLM guidance identifies excessive agency and overreliance as
  risks. The model remains unable to select destinations or trigger actions;
  this projection is created only after a server-validated operator action.
  [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

## Existing Evidence

The local Compose database currently has zero current-library retrieval
telemetry rows and zero recorded runtime `confirm_destination` or
`change_destination` actions. There is no cohort from which to infer a
semantic-retrieval need. However, the existing answer contract already has the
server-validated candidate list, selected destination ID, and action ID at the
exact resolution point. It can calculate the attribution without retaining
those identifiers in a new telemetry field.

## Options Considered

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Infer from AI agreement alone | No new implementation | Cannot distinguish an alternate bounded candidate from an outside-candidate choice | Reject |
| Persist selected library and the candidate IDs for analysis | Allows arbitrary drill-down | Duplicates identity-bearing routing data and increases retention/access surface | Reject |
| Infer from chooser action alone | Small implementation | A broader chooser can still select an existing candidate | Reject |
| Server-compute candidate-set membership at resolution and persist only a fixed status | Precise enough to identify candidate-set gaps, private, aggregate-friendly | Begins only with new resolved decisions | Adopt |

## Attribution Contract

`current_library_candidate_retrieval_outcome_attribution` contains exactly:

- a version; and
- one status ID:
  - `confirmed_candidate`;
  - `changed_to_candidate`;
  - `changed_outside_candidates`; or
  - `routed_not_applicable`.

It is written only when both conditions are true:

1. the original row has a valid current-library retrieval telemetry projection;
   and
2. the current fingerprint-bound runtime-question answer was validated by the
   server.

The server checks candidate membership before discarding all library IDs and
names. The broader chooser status does not itself prove an error. Only
`changed_outside_candidates` means the selected destination was outside the
bounded candidate set at the time the operator resolved the question.

The projection deliberately excludes the classification ID, title, media
metadata, candidate IDs/names, final destination, actor, timestamp, provider,
model, prompt, response, score, and rationale.

## Data Flow

```text
validated runtime-question answer + server-owned candidate list
  -> compute fixed candidate-set membership status
  -> classification history classification_details
  -> aggregate Statistics query
  -> read-only Candidate Retrieval view
```

The attribution is retained independently of the mutable outcome transition
path. A later correction can change the current final destination without
rewriting the historical fact about how the original operator decision was
made. AI/operator agreement remains separately based on the latest final
outcome and must not be interpreted as correctness.

## Aggregate Report

The existing authenticated endpoint adds an operator-candidate-set section
with only aggregate counts:

- attributed decisions;
- confirmed bounded candidates;
- broader chooser selections that stayed in the candidate set;
- broader chooser selections outside the candidate set;
- not-applicable resolutions; and
- resolved decisions without attribution, including pre-feature history.

No row-level drill-down, destination identity, provider data, prompt, response,
or actor data is returned.

## Security Controls

- Candidate membership is calculated from the validated server contract; a
  browser cannot submit a status.
- The persistence boundary rebuilds the allow-listed version/status object.
- No new write endpoint, model call, retry, policy mutation, learning event, or
  routing authority is introduced.
- The aggregate query is static and parameterized, and the existing endpoint
  accepts only a 1-30 completed-UTC-day window.
- The UI uses fixed language and has no outcome-changing action.

## Recommendation Stack

1. Implement and collect this attribution alongside the existing retrieval
   telemetry.
2. First review the rate of `changed_outside_candidates`; this identifies a
   bounded-policy candidate-set gap, not a retrieval-algorithm conclusion.
3. If outside-candidate selections remain low but operator alternatives are
   high, review deterministic policy ranking and evidence weights.
4. Consider a separately governed semantic current-library index only after a
   representative cohort demonstrates a recall problem that candidate-set and
   policy evidence cannot explain.
