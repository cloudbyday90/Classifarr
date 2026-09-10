# Policy purpose outcome quality design

Status: implemented, unreleased. Research was reviewed on 10 September 2026
against primary sources available by 31 August 2026.

## Problem

Declared policy purpose answers what a destination is intended to contain. It
does not by itself show whether later, confirmed operator decisions corroborate
that intent. Current library contents, a title, a model response, or an
embedding similarity are contextual clues; none is independent semantic proof
that a destination is correct.

The Command Center must expose the small, actionable difference without
repeating the dense evidence display from reconciliation or allowing a
historical pattern to route media.

## Selected design

```text
active native policy with a declared, distinct genre purpose
  + repeated policy-authorized manual outcome genre evidence
  + stable source-classification anchor
  -> PostgreSQL-only term intersection
  -> aggregate corroborated / review / awaiting counts
  -> existing no-store Command Center purpose-health response
  -> detailed policy review when a count needs attention
```

`policyPurposeOutcomeQualityPersistence.mjs` receives only the already bounded
policy-purpose review records. It queries the current active library and media
type, then retains only these aggregate facts per library:

- how many repeated, confirmed outcome genre terms exist;
- whether at least one such term equals a currently declared genre purpose
  term.

The evidence query is restricted to active `classification_evidence` with all
of the following properties: the server-owned
`policy_authorized_compatibility` source, `manual_outcome` authority metadata,
a non-null source-classification anchor, and the existing three-confirmation
minimum. Rule values and evidence keys are compared in PostgreSQL and are not
selected into application memory or returned to the browser.

`policyPurposeOutcomeQualityContract.mjs` independently reduces those counts.
It is eligible only after the existing structural check finds a declared,
distinct purpose. Its states are:

| State | Meaning | Effect |
| --- | --- | --- |
| `corroborated` | At least one repeated confirmed outcome term overlaps declared purpose. | Informational. |
| `review_required` | Repeated confirmed outcomes exist but none overlaps declared purpose. | Prioritize policy review only. |
| `awaiting_confirmed_outcomes` | No repeated confirmed outcomes exist yet. | Informational. |
| `no_declared_distinct_purpose` | Structural purpose health has not established a suitable baseline. | Fix structural purpose first. |
| `review_window_truncated` | The fixed policy window is incomplete. | Do not treat as complete. |
| `read_unavailable` | The aggregate outcome query failed. | Fail closed; make no quality conclusion. |

The component extends `policy_purpose_health.v2` rather than adding a second
poll. Structural health and the outcome signal therefore use the same bounded
record window and one administrator-only, parameter-free, `Cache-Control:
no-store` response. The browser accepts an exact nested v1 outcome-quality
shape and rejects an added identity, evidence, or authority key.

## Product wording

The Command Center has one short sentence, not another evidence card. For a
review it says that repeated confirmed operator outcomes **do not overlap** the
declared purpose, asks the administrator to review the purpose, and explicitly
says that the result does not mean a destination is wrong. This replaces vague
phrases such as “contextual rather than semantic proof.” Detailed records stay
in the existing administrator reconciliation view.

No routine refresh receives an ARIA live region. Initial loading remains a
status message and a request failure remains an alert, consistent with the
existing purpose-health card.

## Security and authority boundaries

- The response carries only aggregate counts; it exposes no library, policy,
  rule, term, media, classification, actor, evidence, profile, AI, or RAG
  identity.
- The endpoint remains administrator-only, parameter-free, no-store, and
  read-only.
- Query construction is static and parameterized. The selected-library input
  is normalized to positive database IDs and `movie` or `tv` before it reaches
  `jsonb_to_recordset`.
- A failed evidence read cannot make structural health fail and cannot be
  reported as corroboration.
- The contract flags all semantic selection, policy change, AI/RAG tuning,
  routing, and learning effects as false. This feature creates no policy
  authority and makes no database write.
- There is no schema migration: the feature reads the established policy and
  classification-evidence tables only.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
quality and provenance information so users can assess trustworthiness. This
feature makes its provenance boundary explicit and does not describe a count
as semantic truth.

[NIST AI RMF Core—Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
calls for quantitative and qualitative monitoring, uncertainty handling, and
human oversight. The review state is therefore an observable, bounded
measurement with a human policy-review handoff rather than an automated
decision.

[OWASP's RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
recommends provenance, access controls, and validation around retrieval
systems. This design stays outside the RAG boundary until independently
evaluated semantic evidence is available; it does not turn retrieval or model
output into routing authority.

[WCAG 2.2 SC 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages) and
[W3C's status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
support programmatically determinable important status changes while avoiding
unnecessary interruptions. The compact, quiet refresh behavior follows that
guidance.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat current library contents as semantic truth | Available immediately | Can reflect earlier placements and has no independent provenance | Reject |
| Ask an AI/RAG provider to score every purpose-health refresh | Conversational and potentially rich | Adds provider failure, prompt/retrieval integrity, cost, and uncalibrated authority | Reject for this component |
| Auto-edit or auto-route when outcomes differ | Low operator effort | Historical patterns can be wrong or stale; no offline calibration | Reject |
| Show all raw outcome evidence on Command Center | Explainable in detail | Dense and identity-bearing; duplicates the maintenance view | Reject |
| Bounded corroboration from anchored confirmed outcomes | Explainable, privacy-limited, and useful for targeted review | Needs enough later confirmations; does not validate semantic correctness | Adopt |

## Recommendation stack

1. Keep declared, distinct policy purpose as the deterministic routing
   baseline.
2. Use this aggregate confirmed-outcome signal to prioritize review without
   changing any decision.
3. Build a separate, read-only semantic evaluation only after descriptions and
   bounded candidate sets have independently validated labels and calibration
   measurements.
4. Use RAG/AI only inside that later bounded evaluation, with provenance,
   access control, output validation, and offline error analysis.
5. Consider any autonomous policy adjustment only after a separately approved
   calibration threshold and rollback/audit design; do not couple it to this
   health card.

## Non-goals

This feature does not retrieve media descriptions, construct embeddings, call
an AI provider, modify RAG, retain a corpus, learn a policy, alter an outcome,
write a policy, route media, create a database migration, or create a release.
