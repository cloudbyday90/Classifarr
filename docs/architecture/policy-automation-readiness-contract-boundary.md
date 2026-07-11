# Policy Automation Readiness Contract Boundary

## Status

Implemented for the readiness reducer and its internal callers.

## Problem

The readiness reducer previously accepted a mixed object and silently built an
evidence projection when a caller supplied raw evidence. That gave a lower-level
helper the ability to bypass the bounded evidence, intent, and learning
orchestration path.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side validation before application processing and
  allowlisting for structured input.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side state validation for every multi-step workflow
  transition.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls out trust-boundary validation and workflow-bypass opportunities as
  business-logic review targets.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating verification into normal secure development practice.

## Recommendation

Use two levels of readiness API:

1. `buildPolicyAutomationReadinessFromBoundedContracts` is the runtime and
   rebuild orchestration path. It verifies ready bounded evidence, intent, and
   learning results, matching fingerprints, audits, and evidence quality.
2. `buildPolicyAutomationReadinessFromContracts` is a pure reducer for an
   optional `policy.evidence.v1` projection, a `policy.intent.v1` draft, and
   normalized operational state. It rejects raw evidence keys and invalid
   contract versions.

An intentionally absent evidence or intent contract produces the existing
empty/readiness state. An invalid or raw contract fails immediately instead of
being projected implicitly.

## Pros And Cons

Pros:

- Removes the final direct evidence-projection path from readiness.
- Keeps the proven bounded orchestration path as the only runtime entry point.
- Lets internal presentation and rebuild composition reuse one deterministic
  reducer without needing learning orchestration.
- Makes missing state distinct from malformed or raw state.

Cons:

- Internal callers must construct named evidence and intent contracts.
- Callers that previously relied on raw convenience input now receive an
  explicit error and must use the bounded wrapper.

## Final Recommendation Stack

- `server/src/services/policyAutomationReadinessEngine.mjs`
- `server/src/services/policyAutomationReadinessInputNormalizer.mjs`
- `server/src/services/policyOperatorWorkflow.mjs`
- `server/src/services/policyLibraryPolicyRebuild.mjs`
- `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`

## Outcome

Readiness now has one raw-data orchestration path and one contract-only
reducer:

```text
raw evidence + intent + learning
  -> bounded readiness contracts
  -> runtime readiness result

validated evidence/intent + operational state
  -> contract-only readiness reducer
```

Raw evidence cannot be transformed into readiness by the lower-level reducer.
