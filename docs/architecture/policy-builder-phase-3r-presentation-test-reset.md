# Policy Builder Phase 3R Presentation Test Reset

Status: implemented as the ninth Phase 3R operator-workflow contract.

## Scope

Phase 3R.9 defines how policy-builder presentation tests should be kept,
rewritten, or deleted so tests protect the simplified destination-first
workflow instead of freezing the old modal shape.

This checkpoint creates a server-owned ESM reset contract that classifies
current policy-builder test files, identifies required future presentation
behaviors, and prevents old diagnostic panels or draft-bridge internals from
becoming normal workflow test requirements. The first Vue-facing application of
this reset is documented separately in
[Policy Builder Phase 3R Vue Presentation Test Reset](policy-builder-phase-3r-vue-presentation-test-reset.md).

## Current Best-Practice Inputs

Official sources reviewed as of June 2026:

- Vue Test Utils, A Crash Course:
  <https://test-utils.vuejs.org/guide/essentials/a-crash-course.html>
  - Component tests should render components, simulate user input, and assert
    observable behavior. DOM updates are asynchronous and should be awaited.
- Vitest Guide:
  <https://vitest.dev/guide/>
  - Tests should live in `.test` files and use clear assertions around the
    behavior under test.
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

1. Categorize existing tests before rewriting them:
   - keep as workflow regression,
   - rewrite around destination-first flow,
   - rewrite around evidence-backed options,
   - rewrite around readiness next actions,
   - rewrite around accessibility and decision load,
   - delete abandoned diagnostic surfaces,
   - keep Phase 2R draft bridge tests out of Phase 3R presentation scope.
2. Presentation tests should assert user-visible behavior:
   - starter templates are secondary to destination context,
   - observed evidence is distinct from declared intent,
   - multi-select controls emit typed draft commands,
   - accessible names and disabled reasons are visible/programmatic,
   - hard limits require explicit operator action,
   - readiness links to one next action,
   - internal diagnostic panels are absent from the normal workflow.
3. Do not duplicate Phase 2R draft/bridge parity tests in presentation tests.
4. Keep replay, impact, provider, TMDB, scoring, and parity surfaces as
   verifier-only or deletion candidates, not normal policy-authoring behavior.

## Pros And Cons

### Pros

- Prevents tests from locking in the old modal layout.
- Gives future Vue test rewrites a concrete classification map.
- Keeps Phase 2R draft bridge coverage separate from Phase 3R presentation
  coverage.
- Makes old diagnostic panel tests explicit deletion or verifier-only
  candidates.
- Aligns test intent with accessibility and decision-load contracts from Phase
  3R.8.

### Cons

- This task classifies tests and required behaviors, but does not yet rewrite
  every client test.
- Existing client tests may still contain old layout assertions until the
  follow-up rewrite applies this contract.
- The reset plan must be maintained as files are renamed or deleted.

## Final Recommendation

Use the Phase 3R.9 contract as the gate for presentation test work:

```text
Classify current test -> map to required workflow behavior -> rewrite/delete
old diagnostic assertions -> keep Phase 2R draft bridge tests separate
```

## Implementation

The Phase 3R.9 implementation provides:

- `server/src/services/policyBuilderPhase3PresentationTestReset.mjs`
  - classifies current policy-builder presentation tests,
  - defines required Phase 3R presentation behaviors,
  - keeps draft bridge coverage owned by Phase 2R,
  - marks old impact/replay/template-mechanics diagnostics for deletion or
    verifier-only handling,
  - audits missing behavior coverage and internal diagnostic wording in normal
    product tests.
- `server/src/__tests__/services/policyBuilderPhase3PresentationTestReset.test.mjs`
  - verifies the classification map,
  - verifies all required behaviors are covered,
  - proves replay and impact preview tests are not normal-path tests,
  - proves Phase 2R draft bridge tests stay outside presentation ownership,
  - proves unknown files, unknown categories, missing rewrite behaviors, and
    internal diagnostic wording fail the audit.

## Phase 3R.9 Checklist Result

| Check | Result |
| --- | --- |
| Tests categorized | Yes; current policy-builder presentation and adjacent draft tests are classified. |
| Simplified workflow protected | Yes; required behavior records map to destination-first flow, evidence options, readiness, and accessibility. |
| Phase 0R vocabulary preserved | Yes; normal presentation tests fail when internal diagnostic language appears. |
| Draft/bridge duplication avoided | Yes; draft bridge tests are explicitly Phase 2R-owned. |
| Diagnostic panels removed from normal path | Yes; impact and replay preview tests are delete/verifier candidates, not normal-path assertions. |

## Next Step

Phase 3R now has contracts for 3R.1 through 3R.9 and a Vue-facing application
of the presentation test reset. The next high-value item is Phase 6R.1: define
the simplified runtime decision pipeline contract that consumes Phase 3R
operator intent without carrying old replay/provider diagnostics into the
normal authoring workflow.
