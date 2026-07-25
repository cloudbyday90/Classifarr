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

## Inventory Cutline

The presentation-test inventory is deliberately bounded and machine-checked:

- 30 direct policy-authoring, recovery, compatibility, and runtime-feedback
  component tests are classified exactly once.
- Four adjacent Phase 2R compatibility-bridge tests are retained as
  bridge-owned coverage, not as native authoring presentation requirements.
- The policy-list card test is explicitly excluded because it is a
  policy-management surface, not an authoring or authoring-recovery surface.
- Normal-path coverage can be owned only by `policy_authoring`. Compatibility
  storage cleanup, draft bridge, and runtime verifier coverage must remain
  outside that path.

The audit fails for a missing, duplicate, or out-of-inventory classification,
an invalid exclusion, or a bridge, compatibility, or verifier owner appearing
on the normal authoring path. This turns the test reset into a maintained
cutline rather than a one-time spreadsheet.

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
- W3C WAI, Evaluating Web Accessibility Overview:
  <https://www.w3.org/WAI/test-evaluate/>
  - Accessibility should be evaluated early and throughout development; tools
    help, but targeted human review remains necessary.
- W3C WCAG 2.2, Focus Order:
  <https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html>
  - Tests should preserve a focus order that follows the workflow sequence and
    relationships between controls.

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
   - `runtime_migration_safety`,
   - `native_storage_cleanup`.
4. Keep replay, impact, provider, metadata, scoring, parity, and raw-preset
   surfaces removed from authoring, not as normal policy-authoring behavior.
5. Maintain one bounded inventory:
   - classify every direct policy-authoring test once,
   - explicitly name exclusions,
   - keep compatibility, bridge, and verifier records out of the normal path,
   - fail the contract when a new or renamed test has no classification.

## Pros And Cons

### Pros

- Prevents tests from locking in the old modal layout.
- Gives future Vue test updates a concrete classification map.
- Keeps draft bridge coverage separate from policy-authoring presentation
  coverage.
- Makes old diagnostic panel tests explicit removal candidates.
- Aligns test intent with the policy authoring accessibility contract.

### Cons

- This task classifies tests and required behaviors, but does not yet rewrite
  every client test.
- Existing client tests may still contain old layout assertions until follow-up
  client work applies this contract.
- The bounded inventory must be updated when policy-authoring test files are
  added, renamed, or deleted.

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
  - inventories all 30 direct authoring/recovery component tests and four
    adjacent bridge tests,
  - documents the policy-list card as outside authoring scope,
  - defines required policy-authoring presentation behaviors,
  - keeps draft bridge coverage owned by the draft bridge contract,
  - marks old impact, replay, and template-mechanics diagnostics for removal or
    compatibility-bridge-only handling,
  - audits missing behavior coverage, unknown owners, and internal diagnostic
    wording in normal product tests.
- `server/src/__tests__/services/policyAuthoringPresentationTests.test.mjs`
  - verifies the classification map,
  - verifies all required behaviors are covered,
  - proves replay and impact preview tests are not normal-path tests,
  - proves draft bridge tests stay outside presentation ownership,
  - proves unknown files, unknown categories, unknown behaviors, missing
    protected behaviors, incomplete inventory classifications, duplicate
    records, invalid exclusions, and internal diagnostic wording fail the
    audit.

## Checklist Result

| Check | Result |
| --- | --- |
| Tests categorized | Yes; all 30 direct policy-authoring tests and four adjacent bridge tests are classified, with the policy-list card explicitly excluded. |
| Simplified workflow protected | Yes; required behavior records map to destination-first flow, evidence options, readiness, and accessibility. |
| Product vocabulary preserved | Yes; normal presentation tests fail when internal diagnostic language appears. |
| Draft/bridge duplication avoided | Yes; six compatibility-editor and bridge tests are explicitly draft-bridge-owned. |
| Diagnostic panels removed from normal path | Yes; impact and replay preview tests are removal candidates, not normal-path assertions. |
| Inventory drift detected | Yes; the audit fails for missing, duplicate, out-of-inventory, overlapping-exclusion, and invalid-exclusion records. |

## Next Step

Apply the same cutline to each future Vue rewrite: add or update the test
classification first, then change presentation assertions only around
observable workflow behavior. The next engineering phase remains the policy
evidence engine, which can now rely on a bounded authoring-test contract.
