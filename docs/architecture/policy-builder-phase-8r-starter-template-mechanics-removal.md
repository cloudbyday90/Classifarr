# Policy Builder Phase 8R Starter Template Mechanics Removal

## Status

Implemented as the first current compatibility-path removal slice.

This slice removes the approved manifest path
`client/src/components/policies/PolicyStarterTemplateMechanics.vue` from the
product tree and replaces it with
`client/src/components/policies/PolicyStarterTemplateAccelerator.vue`.

## Problem

Phase 8R closure is blocked while approved compatibility-removal manifest paths
still exist. The starter-template mechanics wrapper was one of the narrowest
remaining paths: it was a product-facing compatibility component imported by
the policy builder modal and tested directly.

The product behavior is still useful as an optional draft accelerator, but the
old path and “mechanics” abstraction belonged to the pre-reimagined policy
builder model. Removing that exact path moves the checkout toward the Phase 8R
legacy-removal state without deleting starter-template draft acceleration.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends secure development practices integrated into the SDLC. This slice
  treats compatibility removal as a controlled change with focused tests and
  traceable docs.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  describes change management and verification practices for secure software
  development. The removal keeps a testable replacement rather than deleting
  behavior without evidence.
- [SLSA build requirements](https://slsa.dev/spec/v1.2/build-requirements)
  emphasize artifact integrity and provenance. Phase 8R removal evidence uses
  explicit manifest paths and current checkout scans.
- [OWASP Software Component Verification Standard](https://owasp.org/www-project-software-component-verification-standard/)
  frames software inventory and risk reduction as part of supply-chain
  assurance. The removed path is treated as compatibility inventory, while the
  replacement is a current product component.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign)
  encourages manufacturers to own security outcomes. The removal avoids
  preserving a stale compatibility abstraction as a permanent surface.

## Recommendations

1. **Remove the exact approved compatibility path.**
   Delete `PolicyStarterTemplateMechanics.vue` instead of hiding it or leaving
   it as a wrapper.

2. **Keep draft acceleration under a current product name.**
   Use `PolicyStarterTemplateAccelerator.vue` to express that templates are
   optional draft accelerators, not policy authority.

3. **Keep the modal import explicit.**
   `PolicyBuilderModal.vue` should import the current component directly so the
   old compatibility path is no longer a product dependency.

4. **Update focused tests to target the replacement component.**
   Tests should validate the same visible behavior through the new component
   path and fail if the old file returns.

5. **Harden final-removal scanning.**
   Product/runtime references should block closure. Deletion-manifest strings in
   control-plane services and tests should not block closure by themselves.

## Pros And Cons

Pros:

- Removes one approved Phase 8R compatibility manifest path from the checkout.
- Preserves useful starter-template draft acceleration.
- Moves product naming away from internal “mechanics” language.
- Keeps the modal behavior stable for operators.
- Makes final-removal evidence less likely to self-block on manifest strings.

Cons:

- The starter-template accelerator still exists as a compatibility draft
  helper until later native-intent storage cleanup decides its final shape.
- Two server preview compatibility paths remain to be removed separately.
- Historical docs and control-plane inventories still mention the removed path
  as removal evidence.

## Final Recommendation Stack

- Replacement component:
  `client/src/components/policies/PolicyStarterTemplateAccelerator.vue`
- Removed component:
  `client/src/components/policies/PolicyStarterTemplateMechanics.vue`
- Modal integration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Focused test:
  `client/src/__tests__/PolicyStarterTemplateAccelerator.test.js`
- Final-removal scanner:
  `scripts/generate-policy-storage-closure-final-removal-audit.mjs`

## Implementation Outcome

Implemented:

- Removed `PolicyStarterTemplateMechanics.vue`.
- Added `PolicyStarterTemplateAccelerator.vue`.
- Updated `PolicyBuilderModal.vue` to import/use the replacement.
- Replaced the focused component test with
  `PolicyStarterTemplateAccelerator.test.js`.
- Hardened the storage-closure final-removal reference scanner to exclude test
  files, Phase control-plane services, and the legacy compatibility inventory
  service.

## Security Outcome

- No storage, Git, archive, or provider side effects are introduced.
- The removed path no longer exists in product code.
- Final-removal scans continue to block product/runtime references while
  allowing control-plane manifest evidence.
- Focused tests verify the replacement component still behaves as an optional
  draft accelerator.

## Follow-Up

The next controlled Phase 8R compatibility-removal slice was
`server/src/services/policyIntentImpactPreview.mjs`, now tracked separately in
[Policy Impact Preview Migration Verifier](policy-impact-preview-migration-verifier.md).
Replay-preview service removal is tracked separately in
[Policy Builder Phase 8R Replay Preview Removal](policy-builder-phase-8r-replay-preview-removal.md).
