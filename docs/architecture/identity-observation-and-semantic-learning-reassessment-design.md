# Identity observation and semantic-learning reassessment design

Date: 2026-09-10. This reassessment reviews commit `5b06bedd` before adding
another RAG or policy component.

## Finding

`5b06bedd` adds a scheduled, aggregate-only source-identity evidence replay.
It chooses a small read-only conflict window, makes external identity checks
after the database transaction commits, and stores only a daily aggregate
receipt. That is useful source-repair telemetry, but it does not read the
policy candidate set, current-library semantic retriever, candidate
adjudication, embedding provider, or routing decision. It therefore cannot
improve a documentary-versus-comedy placement or make AI/RAG participate in
that decision.

The existing semantic path is separate and already operational:

```text
policy-owned two or three candidate libraries
  -> candidate-scoped lexical and semantic retrieval over current inventory
  -> bounded AI comparison or verification
  -> later operator outcome and aggregate frozen-proposal cohort
  -> independently labelled held-out study before any policy-path change
```

The checked local Compose image contains both the semantic-study capture and
the identity observer. It is healthy and reports no pending embeddings. The
remaining limitation is not an absent index or missing observer: the current
policy configuration has no retained, non-profile-only declared-purpose signal
that creates a broad-policy candidate comparison in the held-out study. The
latest full audit recorded zero eligible comparisons under that intentionally
strict boundary.

## Reconciliation decision

Keep source-identity repair observation and semantic candidate evaluation as
separate modules. They have different inputs, authorities, retention needs,
and failure modes. Joining them would let source-server or TMDb availability
affect an unrelated semantic policy path and would not supply the missing
candidate set.

Correct the observer's date arithmetic. The persisted key is a UTC date and
the delete predicate is `observed_on < first_retained_date`. To retain exactly
`N` inclusive dates, the first retained date is today minus `N - 1` days. The
former today-minus-`N` calculation retained an extra date.

## Options

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Combine source replay with RAG/policy evaluation | One apparent pipeline | Couples external identity availability to routing and does not create policy candidates | Reject |
| Leave the 121-date range | No code change | Breaks the stated retention boundary | Reject |
| Correct the inclusive retention boundary | Small, testable privacy correction | No new semantic capability | Adopt |
| Treat profile-derived library contents as declared policy intent | Makes more comparisons appear eligible | Circular evidence: current placements would authorize future placements | Reject |
| Build a draft-only purpose-intent reconciliation from later confirmed outcomes | Can grow valid candidate coverage without silent policy mutation | Requires a separately approved intent-authoring design | Next item |

## Security and quality rationale

The NIST AI RMF Measure guidance calls for documented measurements and
representative evaluation before changing a deployed AI decision path. The
existing held-out study and frozen-proposal cohort meet that role; a source
identity aggregate does not. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP's RAG guidance calls for provenance, retrieval controls, bounded
retention, and fail-closed behavior. Keeping source identity and candidate
retrieval isolated preserves those trust boundaries; an unavailable retrieval
must not become model-only policy authority. [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

W3C's data-quality guidance supports explicit provenance, quality, and
retention semantics. The exact UTC-date test makes the documented retention
period true at its persistence boundary. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

## Recommendation stack

1. Keep the repaired source-identity observer aggregate-only and independent
   of policy/RAG authority.
2. Continue automatic, candidate-scoped semantic retrieval and frozen cohort
   collection; they require no acknowledgement for their content-free
   aggregate observations.
3. Do not promote profile-only library contents to policy authority or use
   source identity as a proxy for semantic fit.
4. Build the next high-value component as a **draft-only declared-purpose
   reconciliation**: it should propose coverage gaps from later confirmed
   outcomes, keep raw library/media context in the existing protected runtime
   boundary, and require the normal policy revision path to apply a change.
5. Once that produces a real 24–32-case held-out cohort with independent
   labels, evaluate a semantic counter-evidence review referral. It may send
   an ambiguous item to comparison or review, but must not auto-route.
