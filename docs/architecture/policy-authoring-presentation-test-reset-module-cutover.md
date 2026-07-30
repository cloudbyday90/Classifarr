# Policy Authoring Presentation Test Reset Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the presentation-test reset
evidence while preserving the existing split between normal policy-authoring
workflow tests, verifier-only preview tests, and server-owned diagnostic
contracts.

## Official Guidance Reviewed

- Vue Test Utils, A Crash Course:
  https://test-utils.vuejs.org/guide/essentials/a-crash-course.html
- Vue Test Utils, Event Handling:
  https://test-utils.vuejs.org/guide/essentials/event-handling
- Vue Test Utils, API Reference:
  https://test-utils.vuejs.org/api/
- Vitest, Writing Tests:
  https://vitest.dev/guide/learn/writing-tests.html
- Playwright, Best Practices:
  https://playwright.dev/docs/best-practices
- W3C WCAG 2.2, Name, Role, Value:
  https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html

## Recommendations

1. Name the artifact after the durable product behavior: presentation-test
   reset.
2. Keep normal workflow tests focused on destination-first authoring,
   accessible next actions, and absence of internal diagnostics.
3. Keep impact and replay preview coverage verifier-only, read-only, and
   explicitly opt-in.
4. Preserve emitted-event assertions for public component contracts instead of
   asserting component internals.
5. Keep provider, TMDB, scoring, parity, and sample-selection diagnostics owned
   by server contracts or verifier-specific tests.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from the final Vue rewrite
  slice currently tracked by the workflow completion audit.
- Keeps presentation tests aligned with user-visible behavior instead of old
  diagnostic panel internals.
- Preserves explicit verifier coverage for read-only/no-execution preview
  behavior.

Cons:

- Some historical changelog entries still mention older phase names as release
  history.
- Runtime pipeline naming still needs follow-up after the Vue rewrite slice
  metadata is fully cut over.
- Broader end-to-end coverage can still improve once the runtime contract is
  simplified.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-presentation-test-reset.md`
- `docs/architecture/policy-authoring-presentation-tests.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

The cutover renamed the presentation-test reset architecture document, updated
the workflow completion audit slice to
`policy_authoring_presentation_test_reset`, and updated roadmap and contract
links to the durable artifact. Browser preview test artifacts were subsequently
retired with the browser migration-preview family.

## Next Step

Run a completion-audit pass over the workflow completion gate itself and then
continue with the simplified runtime decision pipeline contract if no remaining
Vue rewrite slice metadata uses phase-coded production names.
