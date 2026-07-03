# Policy Authoring Starter Templates Module Cutover

Status: implemented.

## Scope

This cutover removes phase-coded naming from the starter-template role contract
without changing behavior. The work keeps templates optional, keeps template
provenance secondary, keeps raw mechanics out of normal authoring, and preserves
typed draft-command application.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- WAI-ARIA Disclosure Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendation

Keep starter templates as a durable policy-authoring service with allowlisted
roles, suggestion buckets, mechanics, and risks. Template application should
produce typed draft commands only after suggestions are mapped into product
vocabulary and validated.

## Pros And Cons

Pros:

- Removes roadmap-phase naming from production services and focused tests.
- Keeps templates useful without making them required policy authority.
- Preserves the typed command boundary for template application.
- Keeps raw compatibility mechanics outside normal authoring.

Cons:

- The durable service still depends on the existing draft-command boundary
  module until that contract receives its own durable naming cutover.

## Final Stack

- Service: `server/src/services/policyAuthoringStarterTemplates.mjs`
- Test: `server/src/__tests__/services/policyAuthoringStarterTemplates.test.mjs`
- Design: `docs/architecture/policy-authoring-starter-templates.md`
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`

## Outcome

The starter-template service now exports `POLICY_AUTHORING_TEMPLATE_*` constants
and `policyAuthoring*Template*` helpers. The completion audit tracks the
contract as `policy_authoring_starter_templates`, and the roadmap points to the
durable starter-template design.

## Next Step

Cut over the accessibility and decision-load contract to durable
policy-authoring names.
