# Policy Intent Input Boundary

## Status

Implemented for server-side intent inference.

## Problem

The intent reducer previously accepted either a `policy.evidence.v1` projection
or arbitrary raw evidence. That made the safe path easy to bypass accidentally:
a caller could construct intent without the evidence input gate, projection
audit, fingerprint, or evidence-quality decision.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic validation as early as possible
  and favors allowlists over denylists.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls out server-side validation, workflow-state validation, resource limits,
  and workflow-bypass review as business-logic security requirements.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  provides outcome-based guidance for integrating secure development practices
  and verification into normal engineering work.

## Recommendation

Use two explicit contracts:

1. `buildPolicyIntentDraftFromEvidenceInput` accepts raw evidence only and
   invokes `buildBoundedPolicyEvidenceProjection` before generating intent.
   Failed input, projection, fingerprint, or quality gates return the existing
   blocked intent-boundary result with no intent draft.
2. `buildPolicyIntentDraftFromEvidenceProjection` is a pure reducer for a
   `policy.evidence.v1` projection. It rejects every other input shape. It is
   suitable for already-verified internal handoffs and focused deterministic
   tests, not as a raw-input boundary.

Workflow composition builds an explicit allow-listed evidence envelope before
using the raw-evidence adapter. Routing and UI diagnostic fields stay outside
that envelope and cannot be reclassified as policy evidence.

## Pros And Cons

Pros:

- Removes the implicit raw-input bypass from intent inference.
- Keeps validation, cardinality bounds, fingerprinting, and quality checks in
  one server-owned boundary.
- Preserves a small pure reducer for deterministic composition and tests.
- Makes evidence versus operational workflow state explicit.

Cons:

- Callers must choose the correct input contract instead of relying on an
  overloaded helper.
- Legacy orchestration paths that still build projections directly need their
  own bounded-boundary cutover rather than being treated as safe by implication.

## Final Recommendation Stack

- `server/src/services/policyEvidenceBoundary.mjs`
- `server/src/services/policyIntentEngine.mjs`
- `server/src/services/policyOperatorWorkflow.mjs`
- `server/src/__tests__/services/policyIntentEngine.test.mjs`
- `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`

## Outcome

Intent inference no longer converts raw evidence implicitly. Raw evidence has
one bounded adapter; projection reduction requires the explicit
`policy.evidence.v1` contract. The normal operator workflow separately
allowlists the evidence fields it supplies to that adapter.
