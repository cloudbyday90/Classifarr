# Policy Authoring Presentation Tests Module Cutover

Status: implemented.

## Scope

This cutover renames the presentation-test classification contract from a
roadmap-phase module into durable policy-authoring language.

The change does not rewrite client tests, change Vue rendering, change policy
saves, alter scoring or routing, touch the database, call AI, call providers, or
write to Arr. It preserves the same side-effect-free classification behavior
while replacing phase owners with stable coverage owners.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- Vue Test Utils, Asynchronous Behavior:
  <https://test-utils.vuejs.org/guide/advanced/async-suspense>
- Vue Test Utils, Crash Course:
  <https://test-utils.vuejs.org/guide/essentials/a-crash-course.html>
- Vitest, Writing Tests:
  <https://vitest.dev/guide/learn/writing-tests.html>
- W3C WCAG 2.2:
  <https://www.w3.org/TR/WCAG22/>
- W3C WCAG 2.2, Name, Role, Value:
  <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>

## Recommendations

1. Name the contract after the product concern it protects: policy-authoring
   presentation tests.
2. Classify tests by durable strategy:
   - keep workflow regression,
   - protect destination-first flow,
   - protect evidence-backed options,
   - protect readiness next actions,
   - protect accessibility and decision load,
   - remove abandoned diagnostic surfaces,
   - keep draft bridge coverage separate.
3. Replace phase owners with coverage owners:
   - `policy_authoring`,
   - `draft_bridge`,
   - `runtime_verifier`,
   - `native_storage_cleanup`.
4. Keep tests focused on observable workflow behavior, awaited DOM updates, and
   accessible names, roles, states, values, labels, and keyboard operation.
5. Keep impact, replay, provider, scoring, TMDB, parity, and raw-preset panels
   out of normal authoring presentation assertions.

## Pros And Cons

### Pros

- Removes phase-coded names from a long-lived server contract.
- Keeps client-test strategy understandable after the roadmap is complete.
- Makes draft bridge, runtime verifier, and native-storage cleanup ownership
  explicit without referring to phase numbers.
- Preserves side-effect-free validation for unknown files, unknown categories,
  unknown owners, missing protected behavior, missing removal rationale, normal
  path diagnostics, and internal diagnostic wording.

### Cons

- Historical Vue rewrite docs still carry roadmap-phase names until their own
  client-facing cutovers are addressed.
- The contract classifies tests but does not itself rewrite every client test.

## Final Stack

- Server contract:
  `server/src/services/policyAuthoringPresentationTests.mjs`
- Server unit coverage:
  `server/src/__tests__/services/policyAuthoringPresentationTests.test.mjs`
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- Standing design record:
  [Policy Authoring Presentation Tests](policy-authoring-presentation-tests.md)

## Outcome

The presentation-test contract now exports
`POLICY_AUTHORING_PRESENTATION_TEST_*` constants and
`policyAuthoringPresentation*` helpers. The records now use stable coverage
owners instead of phase owners, and the completion audit tracks
`policy_authoring_presentation_tests`.

## Next Step

Cut over the remaining Vue-facing policy-authoring workflow docs or begin the
next runtime evidence-engine naming slice, depending on whether the priority is
client terminology cleanup or engine implementation.
