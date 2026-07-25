# Policy Native Classification Question Handoff

## Status

Implemented for live classification results that select an authoritative native
policy destination.

## Problem

Request/import destination admission correctly refused to use a legacy
classification result as proof for request-time learning. The classifier did
not, however, supply the validated runtime question-reduction plan that the
admission boundary requires. Filling that gap by reading an AI explanation,
request payload, provider response, or a library label would let untrusted or
non-authoritative data manufacture policy evidence.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of workflow state and re-derivation of
  security-relevant values. The handoff reconstructs its plan from
  server-owned native runtime state and stored configuration rather than from a
  client or provider payload.
- [NIST SP 800-218, Secure Software Development
  Framework](https://csrc.nist.gov/pubs/sp/800/218/final) supports explicit,
  testable secure-design boundaries. The implementation separates authority
  selection, profile/mapping reads, decision construction, plan reduction, and
  output auditing into small deterministic services.
- [OpenTelemetry General
  Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/) favors
  stable, precise names. The handoff exposes a versioned contract,
  `policy.native_classification_question_handoff.v1`, and bounded status and
  reason identifiers instead of free-form diagnostic text.

## Design

```text
selected server-owned classification destination
  -> matching native runtime candidate only
  -> persisted library profile + stored Arr mapping
  -> runtime evidence projection
  -> automation decision
  -> policy.runtime_question_reduction.v1 plan
  -> request/import destination admission
```

`server/src/services/policyNativeClassificationQuestionHandoff.mjs` applies the
following rules:

1. It accepts a native runtime candidate only when its `library_id` matches the
   classifier's selected library and its native intent contract is validated.
2. It reads only the persisted library profile and stored Arr mapping. A
   missing profile yields a bounded profile-refresh plan; it does not trigger a
   refresh.
3. It converts declared native rule roles into structural evidence signals. It
   never copies declared values, media titles, overviews, requester data, AI
   output, prompts, embeddings, provider payloads, root-folder paths, or route
   error strings into the plan.
4. It evaluates the native runtime outcome before reduction. Failed hard limits
   and missing or conflicting purpose result in review plans, while an active,
   mapped, sufficiently identified, final destination may suppress a question.
   A retry or clarification-pending classifier result remains a review plan.
5. It performs no workflow writes. The audit explicitly rejects a handoff that
   claims media-server/provider access, quota use, routing, question creation,
   learning, classification, or policy-storage mutation.
6. A legacy result, an unselected native candidate, an invalid native contract,
   or no selected library produces no plan. It remains outcome-only downstream.

`classificationServiceCore.mjs` treats a failed handoff as supplemental: it is
logged and converted to `null`, so established classification persistence and
Arr routing continue. A valid `create_operator_question` handoff is now also
passed to the runtime persistence admission boundary before classification
persistence. An admitted review plan becomes an existing pending item through
that established persistence path and therefore stops automatic routing at the
normal final-state gate. Non-question plans remain supplemental output for the
request/import admission adapter to validate again.

## Recommendations

1. Keep native decision-to-plan construction server-side and selected-library
   scoped.
2. Preserve the no-plan outcome for legacy and mismatched results rather than
   attempting a best-effort conversion.
3. Treat a missing library profile as a no-write refresh instruction, not a
   live media-server lookup.
4. Validate the automation decision and question-reduction contracts before
   exposing the plan to any queue or learning component.
5. Use the runtime persistence admission component as the only path permitted
   to materialize a native `create_operator_question` plan.

## Pros And Cons

Pros:

- Enables the existing request-time reducer for authoritative native results.
- Preserves an explicit boundary between current-item classification and future
  learning authority.
- Fails closed for mismatched, legacy, malformed, and unavailable authority.
- Does not add provider activity, quota use, routing, policy writes, or media
  server access to classification.

Cons:

- Legacy classifications intentionally remain outcome-only.
- A missing stored profile defers automation until an existing refresh workflow
  provides current profile evidence.
- A native review plan remains conditional: admission preserves an existing
  question and rejects any altered, legacy, or side-effectful handoff.

## Final Recommendation Stack

1. `policyNativeIntentRuntimeEvaluator.mjs` remains the authoritative native
   policy runtime evaluator.
2. `policyNativeClassificationQuestionHandoff.mjs` selects only the matching
   native runtime candidate and builds a bounded plan from persisted state.
3. `policyRuntimeQuestionPersistenceAdmission.mjs` re-audits and reconstructs
   a native review plan before it can become a pending question.
4. `policyRequestImportDestinationAdmission.mjs` validates the plan again
   before it invokes the request-time reducer.
5. `classificationServiceCore.mjs` applies an admitted pending-question patch
   before the existing classification persistence call and preserves normal
   behavior when the handoff fails.

## Verification

Focused tests cover active mapped native intent, missing profile evidence,
failed hard limits, missing native purpose, selected-library mismatches, legacy
results, no selected destination, and classification continuity when the
supplemental handoff fails.

## Next Step

Implement the **native pending-question resolution presentation adapter**. It
must expose normalized outcome actions in browser and Discord views without
legacy duplicate controls, keep manual destination changes explicit, and never
turn an item-level answer into durable learning by default.
