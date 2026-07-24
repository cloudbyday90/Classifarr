# Policy Authoring Starter Template Accelerator

Status: implemented as bounded compatibility-only template selection.

## Scope

This design applies the durable
[Policy Authoring Starter Templates](policy-authoring-starter-templates.md)
contract to the current Vue policy-builder workflow.

Starter templates are now treated as optional accelerators. A selected library
with valid scoring weights can be saved without a selected starter template.
Template browsing remains available, but it is behind an accessible disclosure
instead of being an always-open normal-path step.

This design does not add native intent storage, draft persistence,
classification, routing execution, provider calls, TMDB calls, AI calls, Arr
writes, database schema, or server routes.

## Research Inputs

Official sources reviewed as of June 2026:

- WAI-ARIA Authoring Practices Guide, Disclosure Pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/>
  - Optional content should be controlled by a button that exposes expanded
    state and, where useful, controls the disclosed region.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Optional controls still need clear instructions so users understand whether
    they are required.
- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
  - The label should describe the purpose of the section, not the old internal
    mechanism.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
  - Save blockers should identify actual missing requirements; optional helper
    panels should not create false errors.
- GOV.UK Design System, Details Component:
  <https://design-system.service.gov.uk/components/details/>
  - Details are appropriate for information some users need, but not for
    essential required tasks.
- U.S. Web Design System, Accordion Component:
  <https://designsystem.digital.gov/components/accordion/>
  - Expandable sections should expose state and keep headings/action labels
    understandable.

## Recommendations

1. Remove starter-template selection from save validity.
2. Keep selected library and valid weight total as the current client save
   requirements.
3. Collapse starter-template mechanics by default.
4. Rename the section from raw signal details to **Starter Template
   Accelerator**.
5. Use disclosure semantics:
   - button with `aria-expanded`,
   - `aria-controls`,
   - disclosed region with an accessible label.
6. Remove product warnings that say starter templates are required.
7. Limit the legacy accelerator to bounded template selection; do not expose
   weights, raw `customSignals`, removal markers, strictness, runtime warnings,
   ranking scores, or policy-usage counts.
8. Preserve legacy serialization only behind the existing bridge when an
   existing compatibility policy is saved.
9. Keep no-template editing conservative until native intent storage
   replaces preset-backed draft targets.

## Pros And Cons

### Pros

- Aligns the Vue workflow with the policy authoring starter-template contract.
- Removes a false save blocker.
- Reduces default decision load in the modal.
- Keeps templates available for users who want a seed.
- Preserves compatibility behavior for existing template-backed policies.

### Cons

- No-template policies can currently save only through the existing
  legacy-compatible payload path with an empty template attachment list.
- Full no-template intent editing still needs the native intent storage
  cutover because the current draft command bridge targets selected templates.
- The template browser still exists until native storage decides which bridge
  mechanics are deleted.

## Final Stack

- State/save validity:
  `client/src/composables/usePolicyBuilderState.js`
- Save boundary:
  `client/src/utils/policyBuilderActionBoundary.js`
- Optional accelerator disclosure:
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue`
- No-template copy cleanup:
  `client/src/components/policies/PolicyIntentEditor.vue`
  `client/src/utils/policyIntentSummary.js`
- Unit coverage:
  `client/src/__tests__/PolicyStarterTemplateAccelerator.test.js`
  `client/src/__tests__/utils/policyBuilderActionBoundary.test.js`
  `client/src/__tests__/composables/usePolicyBuilderState.test.js`
  `client/src/__tests__/utils/policyIntentSummary.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`
  `client/src/__tests__/PolicyIntentEditor.test.js`

## Implemented Outcome

The policy builder now:

- treats starter templates as optional accelerators,
- allows saving with no selected template when a library is selected and
  weights are valid,
- generates a library-scoped policy name without requiring template names,
- removes the old summary warning that said a starter template was required,
- changes the empty editor state to explain templates as optional draft seeds,
- collapses the optional template selector by default,
- exposes the accelerator with `aria-expanded`, `aria-controls`, and a labeled
  region,
- keeps only bounded template selection after the operator opens the
  accelerator,
- removes template customization, weights, raw custom-signal controls, removal
  markers, strictness controls, runtime warnings, ranking scores, and usage
  counts from the product path,
- retains compatibility serialization behind the existing bridge rather than
  presenting it to an operator.

## Follow-Up

The next high-value item is **Policy Authoring Accessibility And Decision Load
Audit**. Now that template selection is bounded and optional, audit the visible
modal for repeated warnings, keyboard flow, disabled reasons, and places where
advanced settings or summary copy still increase decision load.
