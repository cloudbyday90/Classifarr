# Policy Authoring Constraints

Status: implemented as the policy-authoring constraints contract.

## Scope

This document defines how policy-authoring controls represent hard limits,
avoid values, review warnings, certification semantics, and explicit operator
actions. The contract keeps blocking behavior separate from advisory evidence
and removes roadmap-phase wording from production module names and exported
symbols.

This is the canonical constraint vocabulary, not a new scoring surface. The
native workflow now consumes it through the separate [Policy Constraint
Decision Model](policy-constraint-decision-model.md); future UI controls must
use the decision model and typed draft boundary rather than recreate semantics
in the browser.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide Checkbox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final

Applied guidance:

- Blocking controls need clear labels, descriptions, and confirmation behavior.
- Error and disabled states need visible and programmatic explanations.
- User-editable values should be normalized and validated against allowlisted
  sources, controls, and command boundaries.
- Server-side contracts should validate constraints independently from browser
  UI state.

## Recommendations

1. Use three visible constraint concepts: hard limit, avoid, and review warning.
2. Treat hard limits as blocking constraints only after explicit operator
   action.
3. Treat avoid values as advisory by default; they lower confidence or trigger
   review, but do not become hard blocks unless a future explicit strict mode
   says so.
4. Treat observed absence as a review warning, never as an automatic hard limit
   or avoid rule.
5. Show examples of what a hard limit would block when conflict examples are
   available.
6. Keep certification semantics separate: max allowed rating belongs to hard
   limits; avoid rating belongs to avoid controls.
7. Emit typed draft commands only; do not mutate raw compatibility payloads
   from constraint controls.

## Pros And Cons

### Explicit Hard Limits

Pros:

- Operators can see which rules can block routing or classification.
- Existing media-server absence cannot silently create a blocker.
- Runtime behavior can trust that blockers were declared intentionally.

Cons:

- The operator must confirm constraints that might look obvious from existing
  library contents.

### Advisory Avoid Values

Pros:

- Supports "prefer not here" without over-blocking legitimate edge cases.
- Preserves room for review warnings when evidence is incomplete.
- Keeps absence-based hints from becoming policy debt.

Cons:

- Operators may need a future strict toggle for destinations that intentionally
  reject specific values.

### Separate Rating Semantics

Pros:

- Prevents "max PG-13" and "avoid R" from being treated as the same behavior.
- Keeps certification UI copy and server validation aligned.

Cons:

- Requires separate controls even when both use certification values.

## Final Recommendation Stack

- `server/src/services/policyAuthoringConstraints.mjs`
  - `POLICY_AUTHORING_CONSTRAINT_*` constants define controls, intents,
    commands, sources, risks, and control records.
  - `POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS` separates max-rating and
    avoid-rating semantics.
  - `policyAuthoringConstraint*` helpers normalize, validate, summarize, and
    build typed command plans.
- `server/src/__tests__/services/policyAuthoringConstraints.test.mjs`
  - Pins control vocabulary, explicit-operator-action requirements,
    absence-inference guardrails, block examples, rating semantics, command
    boundaries, and fail-closed validation.
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
  - Tracks this contract as `policy_authoring_constraints`.
- [Policy Constraint Decision Model](policy-constraint-decision-model.md)
  - Publishes the immutable server-owned display projection used by the native
    workflow before constraint controls are introduced.

## Outcome

The constraints contract now uses durable policy-authoring names in the service
file, focused test, exported constants, exported helpers, completion audit
record, and standing architecture document.

## Next Step

Implement the constraint draft-command adapter. It must turn an explicit
operator choice backed by the server decision model into a transient typed
draft command without writing policy storage or exposing raw compatibility
payloads.
