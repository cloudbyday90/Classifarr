# Policy Compatibility Native Contract Rehoming

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.5

**Decision date:** 2026-08-01

## Decision

Active policy-authoring behavior no longer imports `PolicyIntentEditor.vue`.
The compatibility editor remains in place only for its two named maintenance
assertions until the native-storage cutover permits its deletion.

The native workflow owns the behavior at its public component boundaries:

| Former compatibility concern | Native owner | Preserved contract |
| --- | --- | --- |
| Belongs-here selection and policy-context accessibility | `PolicyBuilderDestinationQuestions` | Accessible, server-bound, explicitly accepted purpose command plans; no compatibility policy selector. |
| Duplicate prevention and declared-value removal | `PolicyBuilderDestinationQuestions` | Accepted candidates are not offered again, unsupported legacy semantics are disabled, and removal emits a typed plan. |
| Maximum-rating and avoid-rating changes | `PolicyIntentConstraintControlSurface` | Server-projected hard-limit and advisory avoid command plans, including explicit confirmation where required. |
| Review conditions | `ReviewTriggerControl` and `PolicyIntentConstraintControlSurface` | Non-blocking typed review plans, with no legacy `draft-add-signal` event. |

`PolicyIntentEditorParity.test.js` was removed after its active cases moved to
these native boundaries. The removed assertions compared emitted commands to
legacy `customSignals`; that is the retired transport, not the native product
contract. The native tests instead assert typed command-plan version,
component, command boundary, command ID, operator, question, and
server-projected decision effect.

The multi-policy selector and the empty state for no attached legacy preset are
not copied to native creation. Native creation has one server-selected library
context, so recreating either concept would add a false choice and reintroduce
compatibility coupling.

## Research

Official sources were located and reviewed on 2026-08-01 for the requested
current-through-June-2026 baseline.

- Vue recommends component tests for public props, events, and user
  interaction, rather than implementation details or mocked child behavior.
  This supports moving tests to the components that expose the native command
  contracts. [Vue testing guidance](https://vuejs.org/guide/scaling-up/testing.html)
- Vue Test Utils similarly defines component inputs as interactions and props,
  and outputs as DOM, emitted events, and side effects. The rehomed tests use
  only those boundaries. [Vue Test Utils testing guidance](https://test-utils.vuejs.org/guide/essentials/easy-to-test.html)
- NIST SSDF calls for tracking security requirements, risks, and design
  decisions, and for verification that reduces release risk. The immutable
  dependency inventory and focused tests provide that decision evidence.
  [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- NIST's developer-verification guidance includes automated, black-box, and
  historical test cases. The native tests are interaction-level checks and the
  compatibility inventory preserves the historical cutover evidence.
  [NIST IR 8397](https://csrc.nist.gov/pubs/ir/8397/final)

## Options Considered

### Preserve `customSignals` parity in the compatibility editor

**Pros:** Retains the old test with minimal movement.

**Cons:** Makes a compatibility payload the definition of native behavior,
duplicates command coverage, and encourages unsupported semantics to re-enter
the product workflow. Rejected.

### Replace all compatibility tests with one modal integration test

**Pros:** Fewer test files.

**Cons:** Blurs ownership, hides accessibility and disabled-state contracts,
and makes unrelated compatibility branches block native behavior changes.
Rejected.

### Rehome behavior to the native component that publishes it

**Pros:** Tests user-visible interactions and typed events at the correct
owner; unsupported legacy semantics fail closed; later component deletion has
no active product behavior dependency.

**Cons:** Requires deliberate inventory and test-plan synchronization.
Adopted.

## Final Recommendation Stack

1. Keep native destination selection, removal, and unsupported-semantics
   rejection in `PolicyBuilderDestinationQuestions` coverage.
2. Keep hard-limit, avoid, and review behavior in server-projected constraint
   controls and assert only typed command plans.
3. Retain the compatibility editor only for named maintenance assertions until
   the existing native-storage cutover gate is satisfied.
4. Keep the deletion-dependency inventory source-backed and fail closed when a
   compatibility dependency or route reference drifts.
5. Do not restore a browser-owned legacy payload assertion as native behavior.

## Implementation

- Added native public-boundary coverage for accessible purpose selection,
  typed add and remove command plans, duplicate prevention, and unsupported
  legacy candidate rejection in
  `client/src/__tests__/PolicyBuilderDestinationQuestions.test.js`.
- Added native advisory-avoid coverage to
  `client/src/__tests__/PolicyIntentConstraintControlSurface.test.js`, and
  asserted that native review control does not emit the compatibility event.
- Reduced `PolicyIntentEditor.test.js` to its two named compatibility-only
  assertions and removed `PolicyIntentEditorParity.test.js`.
- Updated compatibility and presentation-test inventories so active command
  coverage is declared at native paths and the deletion inventory now reports
  zero pending native rehomes.

## Security Outcome

- Candidate normalization accepts only explicit, server-projected purpose
  semantics. Retired `prefer` and non-purpose candidates remain disabled and
  cannot produce an intent command.
- Constraint values remain server allowlist-projected; the browser cannot
  reinterpret them as raw legacy configuration.
- The browser emits typed local plans only. Persistence, routing, policy
  execution, and native-storage cutover authority remain outside these
  components.
- Compatibility components and storage were not deleted or altered.

## Verification

```powershell
cd client
node scripts/run-vitest.mjs run src/__tests__/PolicyBuilderDestinationQuestions.test.js src/__tests__/PolicyIntentConstraintControlSurface.test.js src/__tests__/ReviewTriggerControl.test.js src/__tests__/PolicyIntentEditor.test.js

cd ../server
node ./scripts/run-jest.mjs --testPathPatterns="policyCompatibilityComponentDeletionDependencies|policyAuthoringCompatibilityRegressionInventory|policyAuthoringPresentationTests" --no-coverage
```

## Next Step

Proceed to **Phase 3R, Task 3R.10.6: Compatibility Retirement Manifest
Reconciliation**. Reconcile the remaining three named compatibility
retirements and eight removal-manifest candidates with their exact
native-storage cutover conditions. Do not delete a component or alter storage
in that task.
