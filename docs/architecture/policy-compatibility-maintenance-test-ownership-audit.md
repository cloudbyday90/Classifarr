# Policy Compatibility Maintenance Test Ownership Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.9.1

**Decision date:** 2026-08-01

## Decision

Compatibility-maintenance tests are now owned by a focused, server-side ESM
audit rather than being classified as normal authoring or generic diagnostic
removal coverage. The audit tracks named observable-behavior scopes, so the
shared policy modal can retain normal-authoring coverage and separately name
the compatibility assertions it contains.

Every retained scope must:

1. Remain outside the normal authoring path.
2. Protect context-before-controls, typed draft-command forwarding, or both.
3. Map every referenced compatibility component to the existing complete
   native-storage deletion gate and a delete-or-replace disposition.
4. Refuse to preserve legacy layout structure or retired diagnostic behavior.

The audit does not make the client draft authoritative, alter a policy payload,
change component rendering, or authorize native-storage removal. It verifies
that regression ownership stays ready for that later cutover.

## Research

Official sources were reviewed on 2026-08-01 against the requested guidance
current through June 2026.

- Vue recommends component tests exercise rendered behavior and public
  component interfaces, rather than internal implementation details. It also
  identifies component tests as the appropriate integration boundary for
  props, events, and user interaction. [Vue testing guide](https://vuejs.org/guide/scaling-up/testing.html)
- Vitest recommends defining the test contract in terms of inputs, outputs,
  side effects, and one focused behavior per test. [Vitest testing in
  practice](https://vitest.dev/guide/learn/testing-in-practice)
- Vitest runs files in isolated environments by default; the ownership audit
  therefore remains a deterministic, side-effect-free inventory rather than a
  shared test-state mechanism. [Vitest improving performance and
  isolation](https://v3.vitest.dev/guide/improving-performance)

## Findings

| Finding | Risk | Resolution |
| --- | --- | --- |
| File-level authoring ownership included compatibility components. | Compatibility tests could be mistaken for normal authoring requirements. | Move the compatibility component source paths to a separate ownership audit. |
| `PolicyBuilderModal.test.js` contains both normal and compatibility assertions. | Splitting the entire file would duplicate expensive fixture setup; leaving it unscoped would blur ownership. | Own its compatibility checks by exact test-name fragments while normal modal checks remain in the authoring registry. |
| Retained components need eventual removal proof, not permanent UI preservation. | Tests could make deletion riskier by freezing obsolete hierarchy or diagnostics. | Require a bridge-inventory artifact, all native-storage deletion gates, no raw mutation authority, and delete-or-replace disposition. |
| Layout snapshots and diagnostic expectations are not the product contract. | Presentation refactors would be blocked by obsolete UI assertions. | Record and reject legacy-layout or diagnostic-behavior protection in every ownership scope. |

## Options Considered

### Keep one file-level authoring registry

**Pros:** No new module or ownership data.

**Cons:** A shared modal test cannot distinguish normal and compatibility
behavior, and component-level compatibility tests remain mislabeled. Reject.

### Duplicate compatibility tests into a separate file tree

**Pros:** Strong physical separation.

**Cons:** Duplicates modal fixture setup and risks diverging assertions without
improving the public contract. Reject.

### Add scoped compatibility-maintenance ownership

**Pros:** Separates ownership by observable behavior, preserves concise test
fixtures, and connects each retained component to the existing native-storage
deletion gate. Adopt.

**Cons:** The inventory requires updates when a named compatibility test is
renamed or a retained component changes.

## Final Recommendation Stack

1. Keep normal authoring and compatibility-maintenance test ownership separate.
2. Use named behavior scopes for shared test files rather than duplicate
   fixtures or file-level labels that conceal mixed responsibility.
3. Protect context-first order and typed draft-command forwarding only.
4. Bind retained compatibility components to their existing native-storage
   deletion requirements and successor disposition.
5. Reject test metadata that freezes legacy layout or diagnostic behavior.
6. Delete the compatibility tests and components together only after the
   complete native-storage cutover gate passes.

## Implementation

- `server/src/services/policyCompatibilityMaintenanceTestOwnership.mjs`
  defines the immutable test-scope inventory and validates removal readiness.
- `server/src/__tests__/services/policyCompatibilityMaintenanceTestOwnership.test.mjs`
  verifies the scope map, source test names, failure modes, artifact linkage,
  and immutability.
- `policyAuthoringPresentationTests.mjs` now delegates compatibility component
  source paths to the dedicated audit while continuing to own normal workflow
  coverage.
- `policyAuthoringWorkflowCompletionAudit.mjs` includes the new contract in
  the policy-authoring completion gate.

## Verification

Focused coverage verifies every scope is non-normal, non-layout-freezing,
non-diagnostic, command-safe, and mapped to a complete native-storage removal
gate. The source audit fails when an owned test name disappears, preventing
metadata from drifting away from executable regression coverage.
