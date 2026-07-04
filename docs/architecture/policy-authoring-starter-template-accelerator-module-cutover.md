# Policy Authoring Starter Template Accelerator Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the starter-template
accelerator evidence while preserving the existing optional disclosure,
template-selection events, compatibility payload behavior, and save-readiness
rules.

## Official Guidance Reviewed

- WAI-ARIA Authoring Practices Guide, Disclosure Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WCAG 2.2, Headings and Labels:
  https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html
- W3C WCAG 2.2, Error Identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- GOV.UK Design System, Details:
  https://design-system.service.gov.uk/components/details/
- U.S. Web Design System, Accordion:
  https://designsystem.digital.gov/components/accordion/

## Recommendations

1. Name the artifact after the durable product behavior: starter-template
   accelerator.
2. Keep starter templates optional and out of save validity.
3. Keep the accelerator collapsed by default because it is compatibility help,
   not the primary policy-authoring path.
4. Preserve disclosure semantics with meaningful labels, `aria-expanded`, and
   `aria-controls`.
5. Preserve existing template events and bridge payload behavior when an
   operator chooses to use a template.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another Vue rewrite slice.
- Keeps the normal policy-authoring path focused on destination intent instead
  of preset mechanics.
- Preserves the accessible disclosure and existing tests that cover collapsed
  state, expansion, and event pass-through.

Cons:

- Template-backed bridge mechanics still exist until native intent storage can
  delete or replace them.
- No-template intent editing remains conservative because current draft
  commands still target selected templates.
- The product label still says "accelerator"; that is intentional durable UI
  language, not phase metadata.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-starter-template-accelerator.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/components/policies/PolicyStarterTemplateAccelerator.vue`
- `client/src/__tests__/PolicyStarterTemplateAccelerator.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

The cutover renamed the starter-template accelerator architecture document,
updated the workflow completion audit slice to
`policy_authoring_starter_template_accelerator`, updated roadmap links to the
durable artifact, and kept the existing Vue starter-template behavior
unchanged.

## Next Step

Cut over the policy-authoring accessibility and decision-load audit naming
because it is the next Vue rewrite slice that still uses phase-coded
completion-audit metadata.
