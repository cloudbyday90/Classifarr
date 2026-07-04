# Policy Authoring Presentation Tests

Status: implemented as the policy-authoring presentation-test contract.

## Scope

Policy authoring presentation tests define how current policy-builder client
tests should be kept, protected, or removed so tests defend the simplified
destination-first workflow instead of freezing the old modal shape.

This checkpoint creates a server-owned ESM contract that classifies current
policy-builder test files, identifies required future presentation behaviors,
and prevents old diagnostic panels or draft-bridge internals from becoming
normal workflow test requirements. The first Vue-facing application of this
contract remains documented separately in
[Policy Authoring Presentation Test Reset](policy-authoring-presentation-test-reset.md).

This contract does not rewrite client tests, change Vue rendering, change
policy saves, change scoring or routing, alter database schema, call AI, call
providers, or write to Arr.

## Current Best-Practice Inputs

Official sources reviewed as of June 2026:

- Vue Test Utils, Asynchronous Behavior:
  <https://test-utils.vuejs.org/guide/advanced/async-suspense>
  - Vue updates the DOM asynchronously; tests that trigger updates should await
    the update before asserting.
- Vue Test Utils, A Crash Course:
  <https://test-utils.vuejs.org/guide/essentials/a-crash-course.html>
  - Component tests should render components, simulate user input, and assert
    observable behavior.
- Vitest, Writing Tests:
  <https://vitest.dev/guide/learn/writing-tests.html>
  - Tests run in isolated contexts, so contract tests should not depend on
    shared mutable state.
- W3C WCAG 2.2, Name, Role, Value:
  <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
  - Custom controls need programmatically determinable names, roles, states,
    and values.
- WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
  - Interactive controls need predictable keyboard operation and focus
    behavior.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Product tests should protect labels and instructions that help users
    complete the workflow.

## Recommendation Stack

1. Categorize existing tests before changing them:
   - keep as workflow regression,
   - protect destination-first flow,
   - protect evidence-backed options,
   - protect readiness next actions,
   - protect accessibility and decision load,
   - remove abandoned diagnostic surfaces,
   - keep draft bridge coverage separate from presentation tests.
2. Presentation tests should assert user-visible behavior:
   - starter templates are secondary to destination context,
   - observed evidence is distinct from declared intent,
   - multi-select controls emit typed draft commands,
   - accessible names and disabled reasons are visible or programmatic,
   - hard limits require explicit operator action,
   - readiness links to one next action,
   - internal diagnostic panels are absent from the normal workflow.
3. Use stable coverage owners instead of roadmap owners:
   - `policy_authoring`,
   - `draft_bridge`,
   - `runtime_verifier`,
   - `native_storage_cleanup`.
4. Keep replay, impact, provider, TMDB, scoring, parity, and raw-preset
   surfaces as verifier or removal candidates, not normal policy-authoring
   behavior.

## Pros And Cons

### Pros

- Prevents tests from locking in the old modal layout.
- Gives future Vue test updates a concrete classification map.
- Keeps draft bridge coverage separate from policy-authoring presentation
  coverage.
- Makes old diagnostic panel tests explicit removal or verifier candidates.
- Aligns test intent with the policy authoring accessibility contract.

### Cons

- This task classifies tests and required behaviors, but does not yet rewrite
  every client test.
- Existing client tests may still contain old layout assertions until follow-up
  client work applies this contract.
- The classification plan must be maintained as files are renamed or deleted.

## Final Recommendation

Use the policy-authoring presentation-test contract as the gate for presentation
test work:

```text
Classify current test
  -> map to required workflow behavior
  -> protect or remove old diagnostic assertions
  -> keep draft bridge tests separate from presentation tests
```

## Implementation

The implementation provides:

- `server/src/services/policyAuthoringPresentationTests.mjs`
  - classifies current policy-builder presentation tests,
  - defines required policy-authoring presentation behaviors,
  - keeps draft bridge coverage owned by the draft bridge contract,
  - marks old impact, replay, and template-mechanics diagnostics for removal or
    verifier-only handling,
  - audits missing behavior coverage, unknown owners, and internal diagnostic
    wording in normal product tests.
- `server/src/__tests__/services/policyAuthoringPresentationTests.test.mjs`
  - verifies the classification map,
  - verifies all required behaviors are covered,
  - proves replay and impact preview tests are not normal-path tests,
  - proves draft bridge tests stay outside presentation ownership,
  - proves unknown files, unknown categories, unknown behaviors, missing
    protected behaviors, and internal diagnostic wording fail the audit.

## Checklist Result

| Check | Result |
| --- | --- |
| Tests categorized | Yes; current policy-builder presentation and adjacent draft tests are classified. |
| Simplified workflow protected | Yes; required behavior records map to destination-first flow, evidence options, readiness, and accessibility. |
| Product vocabulary preserved | Yes; normal presentation tests fail when internal diagnostic language appears. |
| Draft/bridge duplication avoided | Yes; draft bridge tests are explicitly draft-bridge-owned. |
| Diagnostic panels removed from normal path | Yes; impact and replay preview tests are remove/verifier candidates, not normal-path assertions. |

## Next Step

Continue the production naming cutover with the remaining Vue-facing
policy-authoring workflow docs or move into the next runtime evidence-engine
component once naming cleanup for active server contracts is stable.
