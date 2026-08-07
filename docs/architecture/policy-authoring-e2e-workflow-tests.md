# Policy Authoring E2E Workflow Test Contract

## Status

Implemented as Phase 4R Task 4R.9 on August 7, 2026.

## Decision

A server-owned contract inventories every Playwright browser-level
policy-authoring workflow test, maps it to the nine required representative
states from 4R.1, binds it to the existing accessibility and decision-load
rules from 3R.8, and verifies each spec file exists on disk. The contract
enforces that browser-level coverage catches a non-functional primary action
before release and that the full normal flow is keyboard-operable,
responsive, and communicates status without focus theft or duplicate
announcements.

Browser tests do not replace server-contract, client-unit, or integration
tests. The contract explicitly separates browser coverage from authorization
and persistence coverage so a visual test cannot substitute for a trust-
boundary test.

## Required Workflow States

The contract enforces coverage for each representative state from 4R.1:

| State ID | What it verifies |
| --- | --- |
| `eligible_create` | A well-profiled library can create from a server-derived proposal |
| `existing_policy` | A persisted native policy shows its summary, not a second create |
| `sparse_evidence` | A sparse library shows declared-intent guidance, not a failure |
| `stale_proposal` | A stale proposal reloads lifecycle state, not a blind retry |
| `concurrent_create` | Two tabs cannot create a second policy |
| `lost_response_recovery` | A lost browser response queries lifecycle, not resubmits |
| `admission_rejection` | A rejected admission leaves the server projection authoritative |
| `automatic_recovery` | Profile recovery is informational, not a maintainer workflow |
| `no_action_guidance` | A blocked library shows bounded guidance, not dead controls |

## Accessibility and Decision-Load Bindings

Each browser spec must exercise the accessibility rules from 3R.8:

- `keyboard_operable` — full flow via keyboard
- `visible_focus` — focus placement and restoration
- `single_primary_action` — at most one primary action per state
- `no_duplicate_warning_concept` — no stacked warnings
- `no_internal_diagnostics_in_normal_path` — no diagnostic-only cards

These map directly to the 3R.8 `POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS`.

## Official Guidance Reviewed

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Success Criterion 2.1.1
  (Keyboard) and 2.4.3 (Focus Order) require full keyboard operability and
  logical focus sequence. The contract binds each spec to `keyboard_operable`
  and `visible_focus`.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Success Criterion 4.1.3 (Status
  Messages) requires status messages without focus change. The contract binds
  to `no_duplicate_warning_concept` to prevent focus theft.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf) requires testable,
  auditable software. The contract produces a machine-checkable inventory of
  what each browser test covers.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends limiting initial display. The decision-load assertions enforce
  one primary action per state.

## Options Considered

### 1. Manual browser testing only

Pros:

- No new contract.

Cons:

- No regression protection for E2E coverage. A state can lose browser
  coverage without failing any gate.
- Not machine-checkable.

### 2. Reuse the 3R.9 presentation test inventory

Pros:

- Already inventories policy tests.

Cons:

- The 3R.9 inventory covers only Vitest unit/component tests
  (`client/src/__tests__/*.test.js`), not Playwright browser specs
  (`client/browser-tests/*.spec.js`).
- Does not map to the 4R.1 representative states or bind to accessibility
  rules.

### 3. Build a dedicated E2E workflow test contract

Pros:

- Registers Playwright browser specs in a server-owned inventory.
- Maps each spec to the 4R.1 states and 3R.8 accessibility rules.
- Verifies each spec exists on disk.
- Follows the proven 5R.9/7R.9 pattern.
- Fails closed when required state coverage is missing.

Cons:

- Adds one more test-reset contract.

## Final Recommendation Stack

1. Build a pure, side-effect-free contract that inventories Playwright
   browser specs and maps them to workflow states and accessibility rules.
2. Enforce all nine required workflow states; fail closed when any is
   unmapped.
3. Bind each spec to at least `keyboard_operable` and `single_primary_action`.
4. Verify each spec file exists on disk and resolves inside the repo.
5. Explicitly separate browser coverage from server-contract coverage so a
   visual test does not replace authorization or persistence tests.
6. Reject side effects, version mismatch, and unmapped coverage.

## Implementation Outcome

`server/src/services/policyAuthoringE2eWorkflowTests.mjs` owns the contract.
It defines nine workflow-state IDs, five accessibility-rule bindings, the
existing browser spec inventory, file-existence verification, and a self-
validating coverage audit.

Focused regression tests cover the clean current-state audit, each missing
workflow state, a missing spec file, an unknown accessibility rule, side-
effect rejection, and the coverage-boundary separation rule.

## Security Outcome

- Browser-level coverage catches a non-functional primary action before
  release.
- The full normal flow is verified keyboard-operable through the contract's
  accessibility bindings.
- Browser tests do not replace server authorization or persistence tests.
- One primary action per state is enforced by the decision-load bindings.

## Next Task

Phase 4R is now complete (4R.1 through 4R.9). The next work is **Phase 8R
completion** (installation cutover evidence) and eventual release.
