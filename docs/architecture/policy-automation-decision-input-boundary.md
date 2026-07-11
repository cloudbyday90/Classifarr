# Policy Automation Decision Input Boundary

## Status

Implemented for runtime automation decisions.

## Problem

The decision contract accepted either a runtime evidence projection or raw
runtime evidence and silently constructed the projection itself. That made the
state-machine reducer responsible for evidence ownership and allowed callers to
bypass an explicit evidence handoff.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side validation as early as possible and allowlisted
  structured input.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side validation of workflow state and transitions.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  identifies trust-boundary and workflow-bypass analysis as critical review
  work.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified secure development practices integrated with delivery.

## Recommendation

Use two explicit APIs:

1. `buildPolicyAutomationDecisionFromRuntimeInput` owns raw runtime evidence
   and invokes the runtime evidence projection adapter.
2. `buildPolicyAutomationDecisionFromEvidenceProjection` accepts only a
   `policy.runtime_evidence_projection.v1` contract plus operational decision
   facts such as routing, classification status, risk, and policy evaluation.

The projection-only reducer rejects raw evidence fields. The runtime-input
adapter removes those fields before calling it, preserving only the operational
facts that the decision state machine needs.

## Pros And Cons

Pros:

- Makes evidence ownership explicit at the decision boundary.
- Prevents projection-only callers from silently replacing validated evidence.
- Preserves the existing deterministic state machine and side-effect rules.
- Keeps routing and classification facts separate from evidence generation.

Cons:

- Callers must select the correct API for raw runtime input versus an existing
  projection.
- The adapter is an additional named handoff, though it replaces an implicit
  branch with clearer ownership.

## Final Recommendation Stack

- `server/src/services/policyRuntimeEvidenceProjection.mjs`
- `server/src/services/policyAutomationDecisionContract.mjs`
- `server/src/services/policyRuntimeQuestionReduction.mjs`
- `server/src/__tests__/services/policyAutomationDecisionContract.test.mjs`

## Outcome

Decision construction now follows one of two explicit paths:

```text
raw runtime input
  -> runtime evidence projection
  -> projection-only automation decision

existing runtime projection + operational facts
  -> projection-only automation decision
```

The decision reducer cannot derive evidence from raw profile, intent, history,
RAG, metadata, routing-outcome, or freshness fields.
