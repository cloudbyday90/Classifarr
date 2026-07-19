# Policy Builder Library-First Workflow Shell

## Status

Implemented as the first client-adoption component for the server-owned
library-first workflow.

The normal policy-builder entry path now renders a display-only destination
summary from `GET /api/policies/operator-workflow/libraries/:libraryId` before
the retained compatibility editor. It replaces the prior setup-card grid and
standalone routing-readiness panel without changing policy writes.

## Problem

The former entry path asked operators to interpret four local setup cards,
separate routing diagnostics, template mechanics, and advanced scoring before
they could understand a destination. It also reconstructed setup state in the
client from several local inputs.

That conflicts with the product direction: a connected media-server library is
the starting point for destination meaning. The normal screen should first
answer what Classifarr sees, what decision each policy section represents, and
whether automation is ready. It should not make observed data look like an
already-saved policy rule.

## Official Guidance Reviewed

- [W3C WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends visible and semantic groups for related controls. The shell
  renders the five questions as short, consistently structured sections; later
  multi-select controls will use native fieldsets and legends.
- [W3C: Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires dynamic loading, readiness, and error states to be programmatically
  determinable. The shell uses `aria-busy`, `role="status"`, and a bounded
  `role="alert"` error without exposing response details.
- [GOV.UK Design System: Checkboxes](https://design-system.service.gov.uk/components/checkboxes/)
  recommends checkbox groups for independent multiple selections and cautions
  against preselection. Observed values are displayed only in this component;
  none is selected or saved automatically.
- [OWASP Top 10:2025 A01 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)
  states that access control must live in trusted server-side code. The client
  validates that its response is display-only and retains no authority to
  automate, persist intent, or execute routing.

## Design

`usePolicyOperatorWorkflow` owns the request lifecycle:

1. It accepts only a positive library ID.
2. It verifies that the returned library ID matches the selected library.
3. It discards an older request when the selected library changes.
4. It accepts only the versioned display-only contract with explicit false
   automation, persistence, and routing authority.
5. It clears the screen or shows a generic bounded error for invalid or failed
   responses; raw service errors are never rendered.

`PolicyBuilderWorkflowShell` renders:

1. The destination setup summary.
2. The library observations, labeled as suggestions rather than policy rules.
3. The fixed five server-owned questions: what belongs, what should not,
   supporting signals, when to ask, and routing readiness.
4. The server-owned automation readiness next action.

The shell does not render a selection control, save button, live refresh, Arr
request, provider call, quota check, replay, parity, TMDB coverage, impact
preview, or diagnostic panel. Refresh remains the existing explicit profile
operation; after a successful refresh, the modal reloads this cached-workflow
projection.

## Pros And Cons

Pros:

- Makes the first screen library-first and reduces local diagnostic decisions.
- Separates observations from durable intent, preventing broad current-library
  genres from silently becoming a permanent identity rule.
- Uses one server-owned workflow shape for all libraries and configurations.
- Avoids displaying a stale workflow when a user switches libraries quickly.
- Provides accessible loading, status, and error behavior without adding
  nonfunctional controls.

Cons:

- The retained compatibility editor, template accelerator, and advanced
  settings are still visible later in the modal until their individual
  replacement/deletion tasks complete.
- Observed suggestions are not actionable in this component. A later typed
  draft-command component must make accept, remove, and add actions explicit.
- The shell does not yet merge saved native intent with the read projection.

## Final Recommendation Stack

1. Keep the server-owned read endpoint as the only normal source for the
   library-first summary.
2. Use the workflow shell for display, accessibility, and stale-request
   protection only.
3. Add native grouped multi-select controls through typed draft commands next.
4. Replace the retained compatibility editor only after those command paths
   save and round-trip safely.
5. Delete the old template and advanced-control surfaces only through the
   established migration/deletion gates.

## Security Outcome

- The browser sends only a library ID; it does not submit profile evidence.
- Invalid, malformed, mismatched-library, stale, or authority-bearing responses fail closed in the
  client display layer.
- The shell never treats an observation as declared intent.
- The shell cannot call media servers or providers, consume quotas, persist a
  policy, learn from an outcome, or route media.
- Errors are generic and do not expose raw server errors, stack traces,
  credentials, profiles, or routing payloads.

## Verification

- `client/src/__tests__/composables/usePolicyOperatorWorkflow.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`
