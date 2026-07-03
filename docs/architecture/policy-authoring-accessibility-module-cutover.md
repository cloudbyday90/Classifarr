# Policy Authoring Accessibility Module Cutover

Status: implemented.

## Scope

This cutover renames the accessibility and decision-load contract from a
roadmap-phase module into durable policy-authoring language.

The change does not modify Vue rendering, policy saves, scoring, routing,
database schema, runtime learning, AI calls, provider calls, or Arr writes. It
keeps the same validation behavior while making the server contract safe to use
after roadmap phases are complete.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2:
  <https://www.w3.org/TR/WCAG22/>
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Recommendations

1. Keep accessibility contracts in durable product vocabulary, not roadmap-phase
   vocabulary.
2. Treat visible labels, helper text, keyboard operation, visible focus, and
   disabled-state explanations as executable contract data.
3. Keep normal workflow surfaces limited to one primary action.
4. Keep internal diagnostics out of normal authoring surfaces.
5. Validate unknown surfaces and unknown components explicitly so malformed
   data fails closed.
6. Keep the module side-effect-free and ESM-only so tests can assert contract
   behavior without running UI, AI, provider, or database flows.

## Pros And Cons

### Pros

- Removes phase-coded names from the long-lived accessibility contract.
- Preserves the existing safety checks for keyboard/focus behavior,
  multi-select state, chip-removal labels, disabled reasons, destructive
  confirmation, and readiness next actions.
- Keeps completion-audit evidence tied to durable artifact names.
- Reduces future migration work because consumers can depend on product-domain
  names.

### Cons

- Existing roadmap docs still describe the historical phase sequence where that
  context is useful.
- Vue-facing audit docs remain phase-scoped until their own client slice is
  cut over.

## Final Stack

- Server contract:
  `server/src/services/policyAuthoringAccessibility.mjs`
- Server unit coverage:
  `server/src/__tests__/services/policyAuthoringAccessibility.test.mjs`
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- Standing design record:
  [Policy Authoring Accessibility](policy-authoring-accessibility.md)

## Outcome

The accessibility contract now exports
`POLICY_AUTHORING_ACCESSIBILITY_*` constants and
`policyAuthoringAccessibility*` helpers. Completion-audit records now track
`policy_authoring_accessibility` and point to durable docs, service, and test
paths.

## Next Step

Cut over **Presentation Test Reset** to durable policy-authoring naming so the
remaining server-side presentation-test contract no longer carries roadmap
phase names.
