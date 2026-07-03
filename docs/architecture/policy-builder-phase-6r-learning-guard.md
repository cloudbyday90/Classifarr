# Policy Builder Phase 6R Learning Guard

## Status

Implemented as the third Phase 6R engine contract.

This slice decides whether a concrete operator/routing/request outcome may
create a learning candidate. It does not write learning data, update profiles,
mutate policy intent, or execute routing. New runtime and rebuild callers
should use the bounded learning entry point, which requires a successful Phase
6R.2 bounded intent result and the carried Phase 6R.1 evidence projection
fingerprint.

## Problem

Classifarr needs to remember useful decisions without teaching itself from
every manual answer, AI explanation, stale prompt, provider condition, or
diagnostic preview. The prior model blurred these concepts:

```text
final outcome = what happened to this item
learning = what Classifarr is allowed to generalize
```

Phase 6R.3 makes that boundary executable.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI behavior. The learning guard
  keeps generalization explicit, reason-coded, and auditable.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  highlights provenance, data quality, and human oversight risks for generative
  AI. This design blocks AI explanation text from durable learning.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  calls out overreliance, insecure output handling, and excessive agency. The
  guard returns decisions only; it does not let model/provider output write
  policy or learning state.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side validation, business-logic controls, and auditability.
  The guard is a server-owned contract with explicit validation.
- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/)
  describes the risk of systems taking damaging actions from unexpected,
  ambiguous, or manipulated model output. The bounded learning entry point
  prevents learning candidates from being evaluated unless evidence and intent
  already passed deterministic server boundaries.

## Recommendations

1. **Always separate final outcome from learning.**
   A manual answer may resolve the item even when learning is blocked.

2. **Use explicit learning tiers.**
   The supported tiers are:
   - `none`,
   - `exact_item_memory`,
   - `compatibility_evidence`,
   - `identity_evidence`,
   - `hard_limit_evidence`.

3. **Block unsafe learning sources.**
   Learning is blocked from:
   - AI explanation text,
   - broad one-off genre choices,
   - stale questions,
   - ambiguous answer labels,
   - provider quota/cooldown state,
   - replay diagnostic state,
   - TMDB diagnostic state.

4. **Require policy edits for hard limits.**
   Hard-limit evidence cannot be learned directly from a question answer. It
   returns `policy_edit_required`.

5. **Queue profile refresh only for destination evidence changes.**
   Exact-item memory does not require a profile refresh. Compatibility and
   identity evidence candidates do.

6. **Require bounded intent for new callers.**
   `buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent` consumes the
   Phase 6R.2 bounded intent result, blocks failed or unfingerprinted handoffs,
   and attaches a sanitized intent/evidence boundary snapshot to the learning
   decision wrapper.

## Pros And Cons

Pros:

- Makes manual decisions useful without turning every answer into a broad rule.
- Gives runtime/UI/Discord one common server contract for learning eligibility.
- Blocks stale, ambiguous, AI-authored, provider-state, and diagnostic inputs.
- Keeps hard limits under explicit policy-edit authority.
- Creates a clear handoff into automation readiness.
- Prevents future runtime/rebuild callers from evaluating learning candidates
  without bounded evidence and intent provenance.
- Carries a compact fingerprint/provenance handle without copying raw evidence
  labels or provider payloads into learning metadata.

Cons:

- This slice does not persist learning candidates.
- It does not yet consume live pending-question rows.
- Profile refresh is represented as an instruction, not queued here.
- Runtime code must still be wired to call the guard in Phase 7R.
- The original pure decision reducer remains for focused tests and existing
  internal callers; runtime code should use the bounded entry point.

## Final Recommendation Stack

- Question/answer vocabulary:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Learning guard:
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`
- Bounded intent input:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6LearningGuard.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-learning-guard.md`
- Roadmap owner:
  Phase 6R.3 Learning Guard in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The decision shape is:

```text
version
sourceId
finalOutcome
learning
profileRefresh
intentBoundary
```

`finalOutcome` is always separate from `learning`.

`learning` contains:

```text
decisionId
tierId
canWriteLearning
requiresExplicitPolicyEdit
authoritySourceId
candidate
reasonCodes
blockedReasonCodes
writesPerformed = false
```

`profileRefresh` contains:

```text
queue
reasonCodes
```

For bounded runtime/rebuild callers, the learning guard returns:

```text
ok
statusId
intentBoundary
decision
learningAudit
issueCount
issues
nextPhase
```

The bounded status IDs are:

```text
ready
blocked_by_intent_boundary
blocked_by_learning_audit
```

## Security Outcome

- The guard does not perform writes.
- Blocked learning cannot claim write permission.
- Outcome-only decisions cannot carry a learning tier.
- Hard-limit evidence requires explicit policy edit.
- Stale or ambiguous questions can resolve outcomes without teaching the
  system.
- Provider quota/cooldown, replay, and TMDB diagnostic state cannot become
  learning evidence.
- New callers can require successful bounded intent and evidence fingerprint
  provenance before learning eligibility is evaluated.
- The learning boundary records a sanitized intent/evidence snapshot without
  learning from raw AI explanation text or provider diagnostics.

## Next Step

Proceed to **Phase 6R.4 Automation Readiness Engine**. That component should
combine evidence, intent, routing, profile freshness, and learning state into a
small readiness answer such as `ready`, `needs_more_examples`,
`needs_operator_review`, `needs_routing`, `blocked_by_hard_limit`, or
`stale_profile`.
