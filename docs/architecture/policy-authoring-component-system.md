# Policy Authoring Component System

Status: implemented as the policy-authoring component contract.

## Scope

This document defines the stable component vocabulary for the policy-authoring
workflow. The contract exists so the UI rebuild can reason about destination
context, observed library evidence, declared intent, constraints, and readiness
without exposing roadmap phase names or legacy bridge mechanics to production
code.

The component system does not replace Vue screens by itself. It defines the
component ids, option-source semantics, interaction rules, and accessibility
requirements that the UI must satisfy while later code slices continue the
rebuild.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- NIST Secure Software Development Framework SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final

Applied guidance:

- User-input controls need visible labels or instructions that identify what
  the operator is expected to provide.
- Interactive component patterns need keyboard operation, state exposure, and
  accessible names instead of purely visual status.
- Component contracts should be testable and deterministic before the UI is
  rewritten, matching secure-by-design practice for defining and validating
  requirements early.
- Observed library evidence can suggest values, but it must not silently create
  durable policy intent.

## Recommendations

1. Keep the normal authoring path small:
   `DestinationContextCard`, `ObservedProfileSummary`, `IntentSignalPicker`,
   `IntentSignalChipList`, `HardLimitControl`, `AvoidControl`,
   `ReviewTriggerControl`, and `ReadinessNextActionCard`.
2. Keep the optional accelerator explicit: `StarterTemplateSuggestion` can
   accelerate intent after destination context. Retired diagnostic panels are
   not alternate authoring surfaces.
3. Use grouped multi-select and chip editing for simple belongs-here,
   helpful-match, avoid, and review-trigger values.
4. Split option sources into visible groups: observed in library, suggested from
   observed profile, suggested from starter template, common static option,
   operator custom value, already declared, and unavailable because of
   conflicting intent.
5. Require typed draft commands for add/remove operations so components do not
   mutate raw bridge payloads.
6. Require disabled choices, errors, and readiness issues to include visible and
   programmatic reason text.
7. Make readiness cards point to the specific component that resolves the
   issue.

## Pros And Cons

### Stable Component Vocabulary

Pros:

- Gives the UI rebuild a small product-domain vocabulary instead of adding more
  one-off cards and diagnostics.
- Keeps implementation modules durable beyond the roadmap phase that created
  them.
- Lets completion audits verify component coverage without relying on narrative
  status.

Cons:

- Existing Vue components still need later rewrite slices to fully match the
  vocabulary.

### Evidence As Suggestions

Pros:

- Uses the media-server library as source-of-truth context.
- Preserves the line between observed application and operator-declared policy.

Cons:

- Requires clear copy so operators understand that suggested values still need
  acceptance before they become policy intent.

### Typed Command Boundaries

Pros:

- Prevents UI components from mutating legacy bridge structures directly.
- Keeps draft changes easier to test, replay, and eventually persist natively.

Cons:

- Adds a small command abstraction that later Vue work must honor.

## Final Recommendation Stack

- `server/src/services/policyAuthoringComponentSystem.mjs`
  - `POLICY_AUTHORING_COMPONENT_*` constants define target components,
    primitive decisions, option sources, interaction rules, accessibility
    rules, and risk ids.
  - `policyAuthoringComponent*` helpers list, resolve, summarize, and validate
    the component contract.
- `server/src/__tests__/services/policyAuthoringComponentSystem.test.mjs`
  - Pins vocabulary, option-source behavior, typed-command rules,
    accessibility coverage, and immutable records.
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
  - Tracks this contract as `policy_authoring_component_system`.

## Outcome

The component-system contract now uses durable policy-authoring names in the
service file, focused test, exported constants, exported helpers, completion
audit record, and standing architecture document.

## Next Step

Continue with evidence-backed option selection. That component should consume
the durable component-system vocabulary while removing its own phase-coded
module and helper names.
