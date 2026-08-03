# Policy Builder Library-First Workflow Shell

## Status

Historical shell implementation record. The narrow page boundary is now
[Policy Authoring Workflow Presentation Adapter](policy-authoring-workflow-presentation-adapter.md).
This shell retains detail rendering until later Phase 4R components replace it,
but it now requires that validated presentation before showing actionable
controls. New policies can explicitly accept bounded observed-library
candidates; the native create boundary persists that accepted intent
atomically.

The native-create policy-builder entry path now renders a display-only
destination summary from `GET /api/policies/operator-workflow/libraries/:libraryId`.
It replaces the prior setup-card grid and standalone routing-readiness panel
without changing policy writes. Persisted compatibility policies use a separate
maintenance surface and do not request or render this workflow; see [Policy
Compatibility Maintenance Surface](policy-compatibility-maintenance-surface.md).

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

For a new policy only, the shell renders a native grouped checkbox selector for
bounded observed genres, studios, and keywords. The selector emits typed draft
commands; it does not persist, learn, route, call a provider, consume quota,
or preselect any value. The atomic native create path is documented in
[Policy Observed Suggestion Native Creation](policy-observed-suggestion-native-creation.md).

The shell does not render a live Arr request, provider call, quota check,
replay, parity, TMDB coverage, impact preview, diagnostic panel, or a
native-create profile-refresh/reload control. Legacy compatibility editing
retains its separate authorized refresh operation. Native creation reads the
current server projection: its observed-signal picker is available only when
the projection has selectable values or server-admitted custom entry. Missing,
stale, empty, and failed-read states remain status information, while the
server-owned profile lifecycle establishes later evidence without a browser
retry. The detailed decision is documented in [Policy Library-Rebuild Native
Evidence Recovery Retirement](policy-library-rebuild-native-evidence-recovery-retirement.md).

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
  settings still require maintenance until their individual replacement/deletion
  tasks complete, although they are now isolated from the native-create modal
  path.
- Operators must explicitly accept observed candidates before they become a
  native purpose draft; evidence remains deliberately non-authoritative.
- The shell does not yet merge saved native intent with the read projection.

## Final Recommendation Stack

1. Keep the server-owned read endpoint as the only normal source for the
   library-first summary.
2. Use the workflow shell for display, accessibility, and stale-request
   protection only.
3. Keep native grouped multi-select controls on typed draft commands.
4. Keep the retained compatibility editor in its dedicated maintenance surface
   until server-owned migration conditions permit its removal.
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
