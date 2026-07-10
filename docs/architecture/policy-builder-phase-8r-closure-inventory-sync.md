# Policy Builder Phase 8R Closure Inventory Sync

## Status

Implemented.

## Scope

After the starter-template mechanics path was removed, full server validation
found that the replacement component,
`client/src/components/policies/PolicyStarterTemplateAccelerator.vue`, was not
classified in the Phase 1R boundary inventory or the Phase 3R workflow
inventory. That meant the Phase 8R closure chain could not honestly claim that
every current policy-builder surface had an explicit owner and cutline.

This slice updates the inventories only. It does not change the client
component, product workflow, storage, routes, or migration behavior.

## Official-Source Research

- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends verifying software design against security requirements and using
  automated checks where practical. The inventory tests are the automated check
  that prevents unowned policy-builder surfaces.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the W3C understanding document
  for [Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)
  reinforce that UI components need explicit roles and states. In this repo,
  the architecture inventories serve the same product-governance purpose for
  policy-builder surfaces: every component has an explicit role and boundary.
- [Vue component events](https://vuejs.org/guide/components/events.html)
  documents direct child component communication. The accelerator remains a
  presentation/support component that emits explicit events rather than owning
  policy authority.

## Recommendations

1. Keep the accelerator classified as Phase 1R presentation-only support.
2. Keep the accelerator classified as a Phase 3R starter-template accelerator,
   outside the normal authoring path.
3. Add focused assertions for the new component path so future renames do not
   silently break completion evidence.
4. Keep this as a closure-evidence fix, not a product behavior change.

## Pros And Cons

Pros:

- Restores full server validation coverage after the Phase 8R replacement
  component rename.
- Keeps starter templates out of the normal destination-first authoring path.
- Preserves explicit inventory ownership for every current policy-builder
  surface.
- Avoids weakening broad inventory tests.

Cons:

- Adds one more architecture record for a small sync fix.
- Does not remove the remaining client replay-preview UI; that belongs to the
  Phase 6R/7R workflow re-imagination, not this evidence sync.

## Final Recommendation Stack

- Phase 1R inventory:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
- Policy-authoring workflow inventory:
  `server/src/services/policyAuthoringWorkflowInventory.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderBoundaryInventory.test.mjs`
  and
  `server/src/__tests__/services/policyAuthoringWorkflowInventory.test.mjs`
- Completion evidence:
  rerun policy storage closure validation evidence after the sync.

## Implementation Outcome

Implemented:

- Classified `PolicyStarterTemplateAccelerator.vue` as a Phase 1R
  presentation-only support component.
- Classified `PolicyStarterTemplateAccelerator.vue` as a Phase 3R
  starter-template accelerator that is not allowed in the normal authoring path.
- Added focused tests for both classifications.

## Security Outcome

- No storage, provider, AI, Arr, archive, or Git side effects are introduced.
- The fix preserves automated inventory enforcement rather than adding a test
  exception.
- The accelerator remains non-authoritative and cannot become policy engine
  logic through an unclassified path.

## Next Step

Regenerate policy storage closure validation evidence and then refresh the final closure
artifact chain.
