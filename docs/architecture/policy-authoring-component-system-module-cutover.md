# Policy Authoring Component System Module Cutover

Status: implemented.

## Scope

This cutover removes roadmap-phase naming from the component-system contract
that backs policy authoring. The behavior is intentionally unchanged: the work
renames the production module, focused test, exports, helpers, documentation,
and completion-audit record so later components can depend on durable product
language.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- NIST Secure Software Development Framework SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

- Treat component vocabulary as a product contract, not a roadmap artifact.
- Keep accessible labels, disabled reasons, keyboard rules, and state exposure
  in the contract so Vue rewrites have deterministic requirements.
- Keep observed library evidence as suggestions until explicit acceptance.
- Keep verifier-only surfaces outside the normal authoring path.
- Update completion-audit records at the same time as file and export names so
  future audits do not continue to bless obsolete terms.

## Pros And Cons

Pros:

- Reduces production phase-coded naming while preserving the tested behavior.
- Gives downstream option-selection, constraints, readiness, starter-template,
  and accessibility services a stable import path.
- Keeps the migration path auditable because the completion audit now points at
  the durable service, test, and design document.

Cons:

- Downstream services still have their own phase-coded names and should be
  cut over individually.
- The UI still needs later rewrite work before the component vocabulary is fully
  reflected in Vue component names.

## Final Recommendation Stack

- Rename `policyBuilderPhase3ComponentSystem.mjs` to
  `policyAuthoringComponentSystem.mjs`.
- Rename the focused Jest suite to
  `policyAuthoringComponentSystem.test.mjs`.
- Replace `PHASE_3R_COMPONENT_*`, `PHASE_3R_INTERACTION_*`,
  `PHASE_3R_ACCESSIBILITY_*`, and related helper exports with
  `POLICY_AUTHORING_*` and `policyAuthoring*` names.
- Rename the standing design document to
  `docs/architecture/policy-authoring-component-system.md`.
- Update the workflow completion audit record to
  `policy_authoring_component_system`.

## Outcome

The component system is now a durable policy-authoring contract. No runtime
behavior changed; the tests continue to validate the same target components,
option source semantics, interaction rules, accessibility requirements, and
immutable records.

## Next Step

Cut over evidence-backed option selection to durable policy-authoring names.
