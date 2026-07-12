# Policy Authoring Verifier Surface Retirement

Date: 2026-07-12

## Decision

Retire the declarative `MigrationVerifierPanel` authoring surface and the
`migration_verifier_only` readiness exemption. Policy authoring now has one
operator model: destination context, declared intent, explicit constraints, and
one readiness action. Retired diagnostic identifiers are invalid authoring
input; they do not route to a hidden alternate panel.

This decision does not remove the server-owned migration verification and
rollback safeguards that protect native storage work. Those controls remain
bounded, non-product safety contracts and are not policy-builder UI targets.

## Research Inputs

- [OWASP API Security Top 10: Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  recommends maintaining an accurate inventory and retiring unneeded API
  versions and endpoints. A model that accepts retired surface identifiers is
  an inventory and authorization ambiguity.
- [OWASP Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/)
  supports explicit security requirements and reducing unnecessary attack
  surface during design.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports maintaining secure design decisions and validating their
  implementation throughout delivery.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the W3C explanation of
  [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  support a predictable task sequence. A hidden diagnostic branch adds controls
  and focus targets that do not advance the operator's authoring task.

## Options

### Keep a verifier-only authoring panel

Pros:

- Retains a familiar diagnostic destination for maintainers.

Cons:

- Preserves a second policy-authoring mental model after its endpoints and UI
  were retired.
- Allows stale identifiers to pass readiness validation, making future
  restoration easier to miss in review.
- Expands accessibility, authorization, and regression-test obligations for a
  surface that has no product route.

### Hide the panel behind a feature flag

Pros:

- Provides a reversible switch.

Cons:

- Retains dead contracts, branches, and test expectations.
- Makes configuration state part of the security and support surface.
- Delays rather than resolves the ownership decision.

### Remove the authoring surface and reject diagnostic identifiers

Pros:

- Gives operators one predictable authoring path and one readiness decision.
- Makes retired identifiers fail closed in the readiness contract.
- Removes dead accessibility and workflow declarations while retaining bounded
  server-side rollback safeguards.

Cons:

- Maintainers must use the durable evidence, readiness, migration, and rollback
  contracts rather than a policy-builder diagnostic panel.

## Recommendation Stack

1. Remove `MigrationVerifierPanel` from the component vocabulary and every
   accessibility and workflow declaration.
2. Remove the readiness visibility taxonomy and diagnostic record list; reject
   any non-empty diagnostic identifier list with a stable risk ID.
3. Reclassify migration notices and raw template mechanics as compatibility
   bridge support, not verifier-only product behavior.
4. Keep migration verification and rollback server contracts side-effect-free,
   bounded, and unavailable as policy authoring UI routes.
5. Protect the decision with focused contract tests and completion-audit
   evidence.

## Implementation Outcome

- `policyAuthoringComponentSystem.mjs` now has nine authoring components; the
  optional starter-template suggestion is the only support-only component.
- `policyAuthoringAccessibility.mjs` no longer defines a diagnostic panel
  surface.
- `policyAuthoringReadiness.mjs` rejects retired diagnostic identifiers instead
  of treating them as verifier-only.
- Starter-template mechanics and migration notices use the compatibility bridge
  role where applicable.
- The completion audit tracks retired diagnostics as absent rather than as a
  verifier-only normal-path exclusion.

## Verification

- Focused authoring contract tests cover component vocabulary, accessibility,
  readiness rejection, starter-template roles, workflow inventory, and
  completion audit behavior.
- Full client, server, integration, documentation, security, and naming checks
  are required before this change is released.
