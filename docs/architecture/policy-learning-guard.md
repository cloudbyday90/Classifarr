# Policy Learning Guard

## Status

Implemented as the durable policy learning guard contract.

This design decides whether a concrete operator/routing/request outcome may
create a learning candidate. It does not write learning data, update profiles,
mutate policy intent, or execute routing. New runtime and rebuild callers
should use the bounded learning entry point, which requires a successful policy
intent result and the carried policy evidence projection fingerprint.
July 2026 hardening makes that boundary stricter: the learning guard now
requires the upstream bounded intent evidence-fingerprint audit to pass and
rejects intent wrappers whose evidence fingerprint no longer matches the
embedded intent snapshot. It also requires the wrapper and embedded intent draft
to carry matching, usable evidence-quality snapshots before any learning
candidate can be evaluated.

## Problem

Classifarr needs to remember useful decisions without teaching itself from
every manual answer, AI explanation, stale prompt, provider condition, or
diagnostic preview. The prior model blurred these concepts:

```text
final outcome = what happened to this item
learning = what Classifarr is allowed to generalize
```

The policy learning guard makes that boundary executable.

Final-outcome shaping is centralized in
[Policy Final Outcome Normalizer](policy-final-outcome-normalizer.md). The
guard audits that bounded record before it evaluates learning eligibility, so a
routed or missing-mapping outcome cannot lose its route semantics while moving
through the learning boundary.

Every new source adapter must first use the
[Policy Learning Intake Contract](policy-learning-intake-contract.md). That
contract owns the bounded event correlation, source, answer, question,
guard-context, and final-outcome handoff. The guard remains the eligibility
decision point; intake does not create authority or persistence rights.

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
   `buildPolicyLearningDecisionFromBoundedIntent` consumes the
   policy intent result, blocks failed or unfingerprinted handoffs,
   and attaches a sanitized intent/evidence boundary snapshot to the learning
   decision wrapper.

7. **Validate intent handoff integrity before learning.**
   The learning boundary requires the policy intent evidence-fingerprint audit to
   pass and verifies that the bounded intent wrapper and intent draft carry the
   same evidence projection fingerprint.

8. **Require usable intent evidence quality before learning.**
   The learning boundary compares the wrapper and embedded intent quality
   snapshots and blocks missing, insufficient, or mismatched quality before a
   durable learning candidate can be evaluated.

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
- Blocks stale or tampered intent handoffs before any learning candidate is
  evaluated.
- Blocks missing, insufficient, or mismatched evidence quality before any
  learning candidate is evaluated.

Cons:

- This component does not persist learning candidates.
- It does not yet consume live pending-question rows.
- Profile refresh is represented as an instruction, not queued here.
- Runtime code must continue calling the guard before durable learning writes.
- The original pure decision reducer remains for focused tests and existing
  internal callers; runtime code should use the bounded entry point.
- Conservative quality gating can pause learning until upstream evidence has a
  usable identity/compatibility foundation.

## Final Recommendation Stack

- Question/answer vocabulary:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Learning guard:
  `server/src/services/policyLearningGuard.mjs`
- Learning intake contract:
  `server/src/services/policyLearningIntakeContract.mjs`
- Bounded intent input:
  `server/src/services/policyIntentEngine.mjs`
- Test module:
  `server/src/__tests__/services/policyLearningGuard.test.mjs`
- Documentation:
  `docs/architecture/policy-learning-guard.md`
- Quality-gate outcome:
  `docs/architecture/policy-learning-quality-gate.md`
- Roadmap owner:
  Policy Learning Guard in
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

For bounded runtime/rebuild callers, `intentBoundary.evidenceBoundary` includes
a sanitized `quality` snapshot:

```text
version
statusId
score
nextActionId
reasonIds[]
counts
hasIdentityEvidence
hasDeclaredIdentityEvidence
hasObservedIdentityEvidence
hasStaleProfileEvidence
```

`finalOutcome` is always separate from `learning`.
It uses the shared `policy.final_outcome.v1` contract.

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
decisionSource
intentBoundary
decision
learningAudit
issueCount
issues
nextStep
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
- Bounded learning rejects failed upstream fingerprint audits and mismatched
  wrapper-versus-intent evidence fingerprints.
- Bounded learning rejects missing, insufficient, or mismatched wrapper-versus-
  intent evidence quality snapshots.
- The learning boundary records a sanitized intent/evidence snapshot without
  learning from raw AI explanation text or provider diagnostics.
- An explicit `finalOutcome.recorded: false` is preserved by the guard so a
  persistence adapter cannot accidentally authorize learning after its outcome
  write failed. The manual-correction adapter uses that boundary before it
  considers an exact-item memory write.
- Learning intake requires a known source, bounded source-event correlation,
  known answer outcome, known question frame, and a final outcome that matches
  the source and answer before it can project data into this guard.
- Raw AI explanation text and arbitrary provider payloads are excluded at the
  intake boundary while retaining only the guard-blocking state needed to
  reject unsafe learning.

## Next Step

Proceed to **Phase 6R.3.2 Learning Intake Adapter Adoption**. That component
should route each live manual, request-time, native pending, routing, and
Discord path through the intake contract before it reaches this guard.
