# Policy Runtime Resolution Learning Admission

## Status

Phase 5R.6.1 is complete. Policy-runtime resolution now records an explicit
outcome-only learning decision and cannot use the old `generateRule` path to
write exact-match or genre evidence.

## Problem

The previous resolver could mark an item complete and, when an internal caller
set `generateRule`, directly write exact-item and genre evidence in the same
flow. That made the outcome of one manual resolution capable of changing later
classification behavior without an admission decision, provenance, or bounded
learning tier.

An item resolution is a fact about the item. Durable learning is a separate
authorization decision.

## Official Research Basis

The June 2026 baseline for this component uses official guidance:

- [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook)
  describes governed, measured, and managed AI risk practices. The admission
  record makes the decision to generalize observable and reviewable instead of
  treating a resolved item as implicit training data.
- [NIST AI RMF Secure practices](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  supports documented control boundaries and ongoing risk management. The
  resolver applies a deterministic server guard before any future learning
  command can be considered.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports server-side workflow enforcement. The client and Discord do not
  decide learning eligibility, and the transaction fails when its outcome
  record cannot be stored.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends event audit trails with validated, minimized event data. The
  outcome patch stores enumerated reason codes and provenance IDs, not raw AI
  rationale, display labels, or provider payloads.
- [OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/?cat=253) identifies
  excessive agency and improper output handling as risks. A model hint or a
  stale question cannot turn into a durable write through this boundary.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep resolver-owned automatic exact and genre writes | Small change surface; preserves historical behavior | A one-off manual choice becomes broad learning, bypasses the guard, and has no explicit admission trail. |
| Let a runtime answer select a learning tier | Makes learning visible in the same UI | Couples item resolution to policy evolution and lets stale or manipulated runtime controls expand the command surface. |
| Record an outcome-only guard decision, then require a separate authorized learning command | Separates facts from generalization, preserves a compact audit trail, and reuses the existing guarded executor for future writes | Exact-item memory needs a follow-up command rather than silently occurring during resolution. |

## Decision

Use the third option.

`server/src/services/policyRuntimeResolutionLearning.mjs` is a pure admission
adapter. It builds a canonical learning-intake event and delegates the decision
to `policyLearningGuard.mjs`. It is intentionally outcome-only:

- The only decision tier is `none`.
- `canWriteLearning` and profile-refresh queueing must be false.
- A request for the legacy `generateRule` behavior becomes a bounded reason
  code, not a write request.
- Incomplete classification or destination references fail closed.
- Its outcome projection contains only contract/version IDs, reason codes,
  source-event provenance, and guard decision fields.

The existing native pending-resolution provenance remains the native
request-time authority record. Non-native and no-question resolver calls now
write `runtime_resolution_learning` into the same final outcome record. Both
paths use the same `policyLearningGuard.mjs` authority; neither can call an
evidence writer from the resolver.

## Contract

The admission result is `policy.runtime_resolution_learning.v1`:

```text
version
statusId = outcome_only | blocked
sourceId
sourceEventId
questionFrameId
answerOutcomeId
intake
decision
decisionSummary
reasonCodes
sideEffects
audit
```

The persisted outcome projection is deliberately smaller:

```text
runtime_resolution_learning:
  version
  status_id
  source_id
  source_event_id
  question_frame_id
  answer_outcome_id
  decision:
    decision_id
    tier_id
    can_write_learning
    requires_explicit_policy_edit
    authority_source_id
    reason_codes
    blocked_reason_codes
  reason_codes
```

The projection excludes actor identity, raw selected display text, raw AI text,
provider diagnostics, and item metadata. The normal resolved-outcome record
retains its existing authenticated actor and destination fields.

## Security Outcome

- The resolver no longer imports `classificationEvidenceService`.
- The `generateRule` parameter remains tolerated for compatibility but cannot
  create exact-item memory or genre reinforcement.
- The main outcome write must report `updated: true`; otherwise the enclosing
  transaction rolls back instead of completing an un-audited resolution.
- Native pending resolution continues to persist its request-time provenance
  before the final resolved record and remains outcome-only.
- No resolution-side provider call, quota read, profile refresh, routing
  attempt, or durable learning mutation is permitted by the admission module.

## Implementation Outcome

- Added `policyRuntimeResolutionLearning.mjs` and focused unit coverage.
- Removed direct exact-match and genre-evidence writes from
  `clarificationPolicyResolution.mjs`.
- Added compact reason/provenance projection to resolved non-native outcomes.
- Replaced the former learned-pattern test with a regression test proving that
  a legacy rule-generation request is outcome-only.

## Final Recommendation Stack

1. Keep `policyLearningGuard.mjs` as the sole tier and eligibility authority.
2. Keep the runtime resolver outcome-only until an explicit command is
   independently authenticated, locked, idempotent, and executed through
   `policyAuthorizedOutcomeTransactionExecutor.mjs`.
3. Preserve native pending request-time provenance as a specialized source
   record while retaining the same guard authority.
4. Delete or cut over every remaining direct
   `classificationEvidenceService` caller in the later 5R.6 writer inventory;
   do not add a new resolver bypass.

## Verification

- `policyRuntimeResolutionLearning.test.mjs` covers normal resolution,
  route-not-applicable behavior, legacy-rule suppression, compact outcome
  projection, and malformed-reference rejection.
- `clarificationService.test.mjs` verifies that resolution commits a guarded
  outcome record and that a legacy rule request produces no learned pattern.

## Next Task

Proceed with **Phase 5R.6, Task 5R.6.2: Exact-Item Memory Command
Admission**. It must expose a separate, server-authenticated request that
revalidates the resolved outcome and dispatches only through the existing
authorized outcome transaction executor. It must not re-enable a learning flag
on a runtime question answer.
