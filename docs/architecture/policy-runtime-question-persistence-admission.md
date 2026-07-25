# Policy Runtime Question Persistence Admission

## Status

Implemented for authoritative native runtime plans that require an operator
decision before a classification can route.

## Problem

`policy.runtime_question_reduction.v1` determines when a review is necessary,
but it deliberately performs no write. Persisting that plan directly would be
unsafe: it could let substituted handoff data create a pending item, bypass the
existing classification transaction and notification path, or let a legacy
`generate_rule` caller turn an item-level answer into durable policy evidence.

The admission component creates a narrow bridge. It accepts only a valid,
selected-library native handoff, re-derives the canonical reduction plan, and
adapts it to the existing pending-question storage shape. The existing
classification persistence service remains the only component that writes the
classification history row and emits its application and Discord notifications.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of workflow state, explicit state
  transitions, and protection against sequence abuse. Admission reconstructs
  and verifies the transition before a result becomes `awaiting_decision`.
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  describes enforcing data invariants in the persistence layer. This change
  keeps the existing classification-history transaction and its established
  notification idempotency rather than introducing an independent question
  writer or a parallel table without a new invariant.
- [OpenTelemetry General Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports stable, precise semantic names. The persisted envelope and its
  admission states use versioned product-domain contracts and bounded reason
  identifiers rather than free-form workflow text.

## Design

```text
native selected destination
  -> validated native question handoff
  -> persistence admission
       -> re-audit handoff
       -> re-derive canonical question-reduction plan
       -> reject unsafe, legacy, stale, or pre-existing question state
       -> patch the in-memory result to awaiting-decision
  -> existing classification persistence transaction
       -> one classification_history row
       -> existing application and Discord pending notifications
  -> authoritative resolution
       -> final item outcome only
       -> existing routing-after-resolution path
```

`server/src/services/policyRuntimeQuestionPersistenceAdmission.mjs` is pure and
performs no database, provider, quota, media-server, learning, policy, or
routing operation. It validates the full native handoff audit again, validates
the source reduction plan, rebuilds the plan from the embedded automation
decision, and serializes only the canonical result.

The compatibility envelope has two layers:

- `question` and `options` preserve the established browser and Discord
  pending-item presentation contract.
- `runtimeQuestion` and `runtimeQuestionReductionPlan` retain the normalized
  question and fingerprint proof used by guarded downstream consumers.

The `resolve_current_item` option carries the proposed destination for legacy
presentation. The `do_not_learn` outcome intentionally does not constrain the
manual destination selector. The envelope stores its server-owned destination
in bounded metadata so Discord can resolve either outcome without relying on a
cleared pending `classification_history.library_id`.

## Security And Behavior Guarantees

1. Only a `ready`, audited native handoff with a valid
   `create_operator_question` plan can be admitted.
2. The admission rejects reported side effects and recomputes the handoff audit;
   a copied `audit.ok` value is not authoritative.
3. It preserves an existing legacy or pending question rather than replacing it.
4. It rebuilds the planned question, preventing a caller from persisting a
   modified question, free-form label, provider payload, title, path, or AI
   explanation.
5. Admission sets `needs_clarification` before the established persistence
   method runs. Automatic Arr routing therefore stops at the existing
   `not_final` gate until an operator resolves the item.
6. Native runtime envelopes are always outcome-only. The resolver ignores a
   caller-supplied `generate_rule: true`, so no exact-item or genre evidence is
   written from the answer.
7. No migration is required. The existing `classification_history`
   `policy_question`, pending status, and notification fields already hold the
   required canonical envelope atomically.

## Recommendations

1. Keep runtime-question admission pure and immediately before the existing
   classification persistence call.
2. Revalidate every cross-service handoff at the receiving boundary, including
   side-effect assertions and canonical fingerprints.
3. Reuse the existing pending notification workflow instead of adding a second
   writer or notification path.
4. Keep final outcome recording separate from any future learning admission.
5. Present native outcome semantics explicitly in browser and Discord views;
   do not infer learning from a selected label or destination.

## Pros And Cons

Pros:

- Materializes native review decisions without new provider or media-server
  work.
- Reuses established transaction, pending queue, and notification behavior.
- Stops automatic routing exactly when native automation requires review.
- Preserves the normalized evidence-fingerprint chain for Discord and future
  guarded consumers.
- Prevents native answers from silently producing durable learning.

Cons:

- The compatibility envelope temporarily carries both legacy presentation and
  normalized runtime fields.
- Browser presentation still needs a dedicated native answer adapter to make
  `resolve_current_item` and `do_not_learn` clearer than the legacy generic
  action labels.
- A separate persistence record is intentionally not introduced; pending
  question lifecycle remains tied to classification history.

## Final Recommendation Stack

1. `policyNativeClassificationQuestionHandoff.mjs` supplies selected-library,
   side-effect-free native proof.
2. `policyRuntimeQuestionPersistenceAdmission.mjs` re-audits, re-derives, and
   admits only canonical operator-review plans.
3. `classificationServiceCore.mjs` applies the bounded patch before its single
   classification persistence call and returns a bounded admission summary.
4. `classificationPersistenceService.mjs` persists the pending row and sends
   existing app and Discord notifications.
5. `clarificationPolicyResolution.mjs` records the final outcome while forcing
   native envelopes to stay outcome-only.
6. `policyDiscordPendingAnswerLearning.mjs` validates the normalized question
   proof while preserving its no-learning decision.

## Verification

Focused tests cover admission, canonical envelope shape, unsafe-handoff
rejection, existing-question preservation, routing suppression, no implicit
learning, manual destination flexibility, and Discord outcome fallback.

## Next Step

Implement a **native pending-question resolution presentation adapter** for the
browser and Discord. It should render the two normalized outcome actions
without legacy duplicate controls, make manual alternative destination choice
explicit, and keep outcome resolution distinct from any future learning step.
