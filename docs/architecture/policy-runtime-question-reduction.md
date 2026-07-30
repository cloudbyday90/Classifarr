# Policy Runtime Question Reduction

## Status

Implemented as the durable runtime question reduction contract.

This contract consumes the policy automation decision state and decides whether
Classifarr should create a bounded operator question, suppress the question,
ask for routing configuration, refresh the profile, block automation, gather
evidence, or clean up a stale pending question. It does not persist questions,
write learning, route media, call providers, or mutate policy.

Clarification construction now separates raw runtime composition from the
decision-only reducer. The reducer accepts a valid automation decision and
question-specific inputs; raw runtime data must use the explicit adapter.

Classification queue work has a separate adapter,
`policy.runtime_queue_question_reduction.v1`. It re-audits a ready queue
automation decision, passes only the embedded decision and a strict
question-specific input subset to this reducer, and returns opaque queue
provenance with the plan. It does not create, persist, or send a question.

## Problem

Runtime questions had drifted toward explaining internal uncertainty:

```text
Which genre should be prioritized?
Why did AI disagree?
What does this provider diagnostic mean?
What did replay parity show?
```

Those prompts increase operator work and create unsafe learning pressure. The
runtime question reducer narrows questions to destination-focused frames that
align with the server-owned question vocabulary and learning guard.

## Official Guidance Reviewed

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  highlights prompt injection, insecure output handling, excessive agency, and
  overreliance risks. The runtime reducer keeps AI/provider/replay wording out of
  persisted question frames.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-listed values and rejection of unexpected content. The
  reducer allows only product-owned question frames and rewrites rejected legacy
  frames before persistence.
- [Microsoft Human-AI Experience Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  emphasize clear user control, uncertainty communication, and useful feedback.
  Runtime questions now ask about destination fit or concrete next action, not
  internal model diagnostics.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  emphasizes governance, measurement, and risk controls for generative AI
  systems. The reducer separates automation state, question shape, final outcome,
  and learning eligibility.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports consistent semantic naming. The cutover keeps bounded
  `classifarr.runtime.question.*` attributes and moves the payload contract into
  the durable `policy.runtime_question_reduction.v1` namespace.

## Recommendation

Use a deterministic question-reduction contract after automation-state
selection.

The reducer should answer:

```text
Does this runtime state need a question?
If yes, which approved question frame?
If no, what is the next action?
Is an existing pending question stale or legacy?
Can this answer teach Classifarr?
```

The reducer must also preserve the automation decision's sanitized runtime
evidence projection fingerprint. Any future persisted question should be
traceable to the exact evidence-bound automation state that caused the question
without storing raw labels, provider payloads, AI text, or replay diagnostics.

## Pros And Cons

Pros:

- Prevents broad-genre priority and provider-diagnostic prompts from becoming
  persisted questions.
- Keeps `auto_route_ready` decisions silent instead of asking unnecessary
  questions.
- Turns routing gaps into routing actions instead of classification questions.
- Requires stale or legacy pending questions to go through cleanup before answer
  or learning.
- Includes learning eligibility metadata on every planned question.
- Carries a sanitized decision-evidence fingerprint into the plan, planned
  question, and trace so later persistence can audit why the question existed.

Cons:

- Conservative behavior may suppress some old prompts that operators were used
  to seeing.
- A later integration slice still needs to wire this plan into the current
  pending-question creation path.
- Some routing and stale-profile states are now operational next actions rather
  than operator questions, which requires the UI/Discord layer to respect the
  disposition.
- Later integration must preserve the fingerprint instead of re-deriving question
  context from raw runtime data.

## Final Recommendation Stack

1. Consume `policy.automation_decision.v1` as the only runtime decision input.
2. Suppress questions for `auto_route_ready`.
3. Convert `classified_not_routed` and `needs_routing_mapping` into routing
   actions, not persisted classification questions.
4. Convert `stale_profile_retry` into a profile-refresh action.
5. Create operator questions only for:
   - hard-limit review,
   - destination/outlier review,
   - missing evidence review.
6. Use only approved acceptable question frames:
   - `destination_fit`,
   - `missing_evidence`,
   - `hard_limit_conflict`,
   - `routing_gap`,
   - `stale_profile`,
   - `outlier_review`.
7. Rewrite rejected legacy frames before persistence:
   - `broad_genre_priority`,
   - `ai_authored_policy_edit`,
   - `provider_specific_diagnostic`,
   - `replay_parity_interpretation`.
8. Mark every planned question as learning-ineligible by default. Durable
   learning remains owned by the policy learning guard.
9. Carry the automation decision evidence fingerprint through the
   question-reduction plan, planned question, and bounded trace attributes.
10. Reject plans where the question or trace fingerprint differs from the plan
    fingerprint.
11. Require the carried automation decision validation result and bounded trace
    `decision_valid` attribute to agree before question plans can pass
    validation.
12. Keep automation-decision composition outside clarification reduction. Use
    `buildPolicyRuntimeQuestionReductionFromRuntimeInput` for raw runtime
    input and `buildPolicyRuntimeQuestionReductionFromAutomationDecision` for
    an existing valid decision.
13. Rebuild the planned disposition, action, question, learning metadata, and
    trace from the embedded decision before accepting a plan. A changed plan
    cannot turn an automatic route into a routing configuration or question
    workflow.
14. For classification queue execution, use the dedicated queue adapter rather
    than passing a queue envelope directly to the generic reducer. Re-audit the
    queue decision, retain only opaque task/evidence/execution fingerprints,
    and bind the plan fingerprint to queue evidence before any later admission
    or persistence component acts.

## Implemented Files

- Runtime question reduction contract:
  `server/src/services/policyRuntimeQuestionReduction.mjs`
- Queue question-reduction adapter:
  `server/src/services/policyRuntimeQueueQuestionReduction.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs`
- Queue adapter tests:
  `server/src/__tests__/services/policyRuntimeQueueQuestionReduction.test.mjs`
- Automation decision dependency:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Clarification decision-boundary outcome:
  `docs/architecture/policy-runtime-clarification-decision-boundary.md`
- Question vocabulary dependency:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Roadmap owner:
  Runtime Question Reduction in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_RUNTIME_QUESTION_DISPOSITION_IDS`
- `POLICY_RUNTIME_QUESTION_REASON_IDS`
- `POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS`
- `buildPolicyRuntimeQuestionReductionFromAutomationDecision`
- `buildPolicyRuntimeQuestionReductionFromRuntimeInput`
- `buildPolicyRuntimeQuestionReductionAudit`
- `validatePolicyRuntimeQuestionReduction`

## Dispositions

`suppress_question`
: No question should be created. Used for auto-route-ready decisions.

`create_operator_question`
: A bounded approved question can be created. Used for hard-limit review,
  destination/outlier review, or missing-evidence review.

`configure_routing`
: Routing must be configured. The reducer exposes `routing_gap` context but does
  not create a classification question.

`refresh_profile`
: Media-server profile evidence should be refreshed before deciding.

`block_automation`
: Automation is blocked without creating a question.

`gather_evidence`
: Evidence is too weak to ask a useful question.

`stale_question_cleanup`
: An existing stale or legacy pending question must be cleaned before it can be
  answered or learned from.

## Security And Data Handling

- The reducer does not call providers.
- The reducer does not persist questions.
- The reducer does not write learning or policy changes.
- The reducer rejects unknown or rejected question frames for created questions.
- The reducer marks planned answers as learning-ineligible by default.
- Stale or legacy questions are routed through cleanup before answer or
  learning.
- Trace output uses bounded reason codes and frame ids, not provider payloads or
  AI text.
- The reducer carries only sanitized decision-evidence fingerprint provenance
  and rejects missing or mismatched fingerprint bindings.
- The reducer carries the automation decision validation result and mirrors that
  result in bounded trace attributes so stale or forged decision handoffs cannot
  create questions.
- The reducer recomputes its full output tuple from the embedded automation
  decision and rejects altered dispositions, actions, question shapes, learning
  metadata, reason records, counts, or additional trace attributes.
- The decision-only reducer rejects raw decision inputs and requires a valid
  `policy.automation_decision.v1` contract before it plans a clarification.
- The queue adapter accepts only a revalidated ready
  `policy.runtime_queue_automation_decision.v1` envelope and a strict subset
  of stale-question-cleanup and frame-override fields. It rejects raw queue,
  provider, and runtime data instead of forwarding them to this reducer.

## Test Coverage

The focused test suite verifies:

- auto-route-ready suppresses questions,
- classified-not-routed becomes a routing action,
- hard-limit and missing-evidence states create bounded questions,
- avoid/high-risk review uses `outlier_review`,
- broad-genre priority frames are rewritten before persistence,
- stale or legacy pending questions require cleanup,
- question plans carry the automation decision evidence fingerprint,
- question plans carry the automation decision validation result,
- planned questions and traces must match the plan fingerprint,
- traces must mirror the carried decision-valid state,
- raw runtime input must use the explicit adapter, while the decision-only
  reducer rejects raw decision inputs and invalid decisions,
- invalid plans with rejected frames, learning enabled, auto-route questions, or
  side effects fail validation,
- the component audit points to the request-time learning step.
- queue question reduction re-audits queue decisions, preserves only opaque
  execution provenance, binds plan evidence to queue evidence, and rejects raw
  or unsupported input and all claimed side effects.

## Outcome

The runtime question reducer gives runtime question creation a hard gate:

```text
valid automation decision
  -> question reduction disposition
  -> persisted question only when necessary
```

The reducer is intentionally not wired into the live pending-question path yet.
That integration should happen after the contract proves which states should
ask, which states should route/configure/refresh, and which stale questions
must be cleaned before learning.

## Next Step

Request-time learning and destination selection should use this
question-reduction contract with the policy learning guard so request-time and
manual destination choices become guarded evidence only when eligible.
