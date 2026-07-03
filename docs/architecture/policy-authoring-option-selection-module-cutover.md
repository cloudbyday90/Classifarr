# Policy Authoring Option Selection Module Cutover

Status: implemented.

## Scope

This cutover removes roadmap-phase naming from the option-selection contract
that backs policy authoring. Behavior is intentionally unchanged: option source
normalization, evidence handling, disabled-state validation, broad-genre
guardrails, and typed command-plan output remain pinned by the focused test
suite.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide Combobox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- WAI-ARIA Authoring Practices Guide Patterns: https://www.w3.org/WAI/ARIA/apg/patterns/
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

## Recommendations

- Treat option selection as a durable policy-authoring contract.
- Keep source and state IDs allowlisted through exported constants.
- Keep evidence read-only until explicit acceptance creates a typed command.
- Keep disabled choices explainable and programmatically testable.
- Update completion-audit records at the same time as module and export names.

## Pros And Cons

Pros:

- Removes another production phase-coded module while preserving behavior.
- Stabilizes the import surface for Vue picker and chip controls.
- Keeps the completion audit aligned with durable service, test, and document
  names.

Cons:

- Downstream hard-limit, avoid, readiness, starter-template, and accessibility
  services still carry phase-coded names and should be cut over separately.

## Final Recommendation Stack

- Rename `policyBuilderPhase3EvidenceBackedOptionSelection.mjs` to
  `policyAuthoringOptionSelection.mjs`.
- Rename the focused Jest suite to `policyAuthoringOptionSelection.test.mjs`.
- Replace phase-coded option-selection exports and helpers with
  `POLICY_AUTHORING_OPTION_SELECTION_*`,
  `POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS`, and
  `policyAuthoringOption*` names.
- Rename the standing design document to
  `docs/architecture/policy-authoring-option-selection.md`.
- Update the workflow completion audit record to
  `policy_authoring_option_selection`.

## Outcome

The option-selection contract is now a durable policy-authoring contract. No
runtime behavior changed; the tests continue to validate source behavior,
read-only evidence, disabled reasons, broad genre guardrails, and typed command
plans.

## Next Step

Cut over hard-limit and avoid UX to durable policy-authoring constraint names.
