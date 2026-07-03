# Policy Authoring Destination Flow

Status: implemented as the durable destination-flow contract for policy
authoring.

## Scope

This document defines the normal policy-authoring flow around the selected
media-server destination. The media-server library remains the source of
observed application, while operator-declared intent remains explicit and
bounded.

The flow keeps templates, scoring mechanics, replay diagnostics, provider
diagnostics, and legacy payload details out of the normal path until the
operator understands the destination and can decide what belongs there.

## Official Guidance Reviewed

- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Make library selection and observed destination meaning the first normal
   workflow steps.
2. Use destination questions as stable product language:
   - `What belongs here?`
   - `What should not go here?`
   - `What helps but should not decide alone?`
   - `When should Classifarr ask?`
   - `Can this route?`
3. Allow starter templates only after destination context is visible.
4. Empty states must show one operator next action:
   - new library -> sync media server library,
   - sparse library -> add declared intent,
   - unmapped library -> map routing destination.
5. Keep these mechanics out of the normal flow:
   - starter-template-first setup,
   - raw scoring weights,
   - replay/provider diagnostics,
   - legacy preset internals,
   - raw bridge storage.

## Pros And Cons

### Destination-First Flow

Pros:

- Operators reason about the library they already understand.
- Observed media-server contents provide context without becoming automatic
  rules.
- The flow aligns with the automation model: Classifarr asks for intent only
  where evidence or routing is insufficient.

Cons:

- Existing template-first surfaces must be repositioned as accelerators.
- Later UI work must keep this sequence clear instead of exposing all mechanics
  at once.

### Explicit Empty-State Next Actions

Pros:

- New, sparse, and unmapped libraries become actionable.
- Operators see the next setup step without needing provider/replay internals.
- The workflow can be tested as deterministic contract data.

Cons:

- UI components must map each next action to a concrete control or settings
  route.

### Durable Production Naming

Pros:

- Keeps production modules useful after roadmap phases are finished.
- Lets downstream contracts consume stable destination-flow vocabulary.
- Reduces phase-coded references in imports, tests, docs, and completion
  evidence.

Cons:

- Dependent components still need their own durable-name cutovers.

## Final Recommendation Stack

- `server/src/services/policyAuthoringDestinationFlow.mjs`
  - declares ordered workflow steps,
  - declares destination questions,
  - declares empty states and next actions,
  - marks starter templates as allowed only after destination context,
  - lists forbidden normal-flow mechanics,
  - validates step sequence, starter-template placement, empty-state actions,
    and forbidden mechanics.
- `server/src/__tests__/services/policyAuthoringDestinationFlow.test.mjs`
  - pins the ordered workflow,
  - proves the question language,
  - verifies empty-state next actions,
  - blocks starter-template-first and internal mechanics from the normal flow.
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
  - records the destination-flow contract in the policy-authoring completion
    gate.

## Normal Workflow

```text
select connected library
  -> review observed destination meaning
  -> accept or edit declared intent
  -> confirm hard limits
  -> confirm routing readiness
  -> save or defer
```

Only destination context, declared intent editing, hard-limit confirmation,
readiness next actions, and save/defer controls belong in the normal path.
Everything else must be a support/verifier flow or a later server-owned engine
contract.

## Outcome

The durable destination-flow cutover:

- renamed the production module to `policyAuthoringDestinationFlow.mjs`,
- renamed the focused test to `policyAuthoringDestinationFlow.test.mjs`,
- replaced exported phase-coded destination constants and helpers with
  `POLICY_AUTHORING_DESTINATION_*` and `policyAuthoringDestination*` names,
- updated downstream authoring contracts to import the durable destination-flow
  vocabulary,
- moved completion-audit evidence to this durable architecture document.

## Next Step

Cut over the component-system contract to durable policy-authoring naming
because it is the next direct consumer of the destination-flow vocabulary.
