# Policy Runtime Clarification Decision Boundary

## Status

Implemented for runtime clarification reduction.

## Problem

The runtime clarification reducer accepted either an existing automation
decision or raw runtime inputs and silently rebuilt the decision. That allowed a
question-planning caller to own evidence and decision composition implicitly,
which blurred a server-side workflow boundary.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side state transitions and rejection of skipped or
  reordered workflow steps.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side allowlist validation for syntactic and semantic
  input correctness.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls for reviewing workflow bypasses and trust boundaries during changes.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified, maintainable secure-development changes.

## Recommendation

Use two explicit APIs:

1. `buildPolicyRuntimeQuestionReductionFromRuntimeInput` owns raw runtime
   composition and builds the automation decision through its dedicated
   runtime-input adapter.
2. `buildPolicyRuntimeQuestionReductionFromAutomationDecision` accepts a valid
   `policy.automation_decision.v1` contract and only question-specific fields.

The decision-only reducer rejects raw evidence, projection, routing,
classification, policy-evaluation, and side-effect fields. The runtime adapter
rejects a supplied automation decision so callers must select one ownership
path. Neither path persists questions, learns, routes, refreshes, or calls a
provider.

## Pros And Cons

Pros:

- Clarification planning cannot silently bypass automation-decision validation.
- Existing decision fingerprints and validation proof remain the sole upstream
  authority for a question plan.
- Raw runtime composition has one explicit, testable entry point.
- Question-specific legacy cleanup and frame normalization remain available
  without granting them decision-building authority.

Cons:

- Internal callers must deliberately select raw runtime adaptation or an
  existing automation decision.
- Invalid automation decisions now fail at the boundary instead of producing a
  plan that later fails validation.

## Final Recommendation Stack

- Runtime decision adapter:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Clarification decision boundary:
  `server/src/services/policyRuntimeQuestionReduction.mjs`
- Focused regression coverage:
  `server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs`
- Runtime completion consumer:
  `server/src/services/policyRuntimeCompletionAudit.mjs`

## Outcome

```text
raw runtime input
  -> automation decision runtime adapter
  -> valid automation decision
  -> decision-only clarification reducer

existing valid automation decision + question-specific input
  -> decision-only clarification reducer
```

The clarification reducer no longer rebuilds raw runtime evidence or an
automation decision.
