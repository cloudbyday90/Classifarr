# Policy Authoring Constraints Module Cutover

Status: implemented.

## Scope

This cutover removes roadmap-phase naming from the hard-limit, avoid, and
review-warning contract. Behavior is intentionally unchanged: the focused tests
still pin explicit operator action, absence-inference guardrails,
certification semantics, block-example requirements, and typed command plans.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide Checkbox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

- Treat constraints as a durable policy-authoring contract, not a roadmap UI
  slice.
- Keep hard limits, avoid values, and review warnings structurally separate.
- Keep max-rating and avoid-rating semantics separate.
- Require explicit operator action before any blocking or advisory constraint
  can affect policy intent.
- Keep command boundaries typed and reject raw bridge mutation paths.

## Pros And Cons

Pros:

- Removes another production phase-coded module while preserving behavior.
- Stabilizes constraint imports for Vue certification and policy intent
  controls.
- Keeps completion-audit evidence aligned with durable service, test, and
  document names.

Cons:

- Readiness, starter-template, accessibility, and presentation-reset services
  still carry phase-coded names and should be cut over individually.

## Final Recommendation Stack

- Rename `policyBuilderPhase3HardLimitAvoidUx.mjs` to
  `policyAuthoringConstraints.mjs`.
- Rename the focused Jest suite to `policyAuthoringConstraints.test.mjs`.
- Replace phase-coded constraint exports and helpers with
  `POLICY_AUTHORING_CONSTRAINT_*`,
  `POLICY_AUTHORING_CERTIFICATION_SEMANTIC_IDS`, and
  `policyAuthoringConstraint*` names.
- Rename the standing design document to
  `docs/architecture/policy-authoring-constraints.md`.
- Update the workflow completion audit record to
  `policy_authoring_constraints`.

## Outcome

The hard-limit and avoid UX contract is now a durable policy-authoring
constraints contract. No runtime behavior changed; tests continue to validate
the same blocker/advisory separation, explicit-action requirements, absence
guardrails, rating semantics, and typed command plans.

## Next Step

Cut over readiness and next-action surface to durable policy-authoring
readiness naming.
