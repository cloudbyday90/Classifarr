# Policy Library-Rebuild Empty-State Sync Retirement

## Status

Implemented as the residual browser-path cutover identified by Phase 6R.6.1
and the follow-on to Phase 6R.6.11.1.

## Problem

The native-create empty state still exposed `Sync library now`. Its browser
handler performed a full library sync, requested a profile refresh, reread the
operator workflow, and announced the result. That made an empty library a
manual browser recovery workflow even though policy authoring is meant to
display server-owned evidence and collect explicit intent.

The path also created an inconsistent model: the server-owned persisted-policy
profile recovery lifecycle was automatic, while a profile-less library in
native creation depended on the current browser session.

## Official Guidance Reviewed

The following official guidance was reviewed on July 31, 2026, covering the
user's requested current-through-June-2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-enforced workflow state and protection against unintended
  sequences. The browser no longer composes sync, refresh, and reread calls.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires server-side validation and authorization for state transitions.
  This change retains server-owned lifecycle and authorization boundaries
  instead of treating a UI action chain as the authority.
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports programmatically determinable status without an unnecessary focus
  change. The remaining mapping transition keeps its scoped status; guidance
  is exposed as ordinary text.
- [W3C WCAG 2.2: Change on Request](https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html)
  supports predictable context changes. Profile absence now changes only the
  shown guidance and cannot trigger browser-side library work.

## Options Considered

### Keep the browser sync-and-refresh action

Pros:

- An operator can request immediate observed-library suggestions.

Cons:

- Keeps lifecycle progress dependent on a browser session.
- Makes the browser coordinate multiple privileged state transitions.
- Reintroduces manual recovery into the intent-first creation flow.

### Hide the button but retain its composable and contract

Pros:

- Produces a small visible UI change.

Cons:

- Leaves dead browser authority, tests, and vocabulary in the source tree.
- Does not prevent a future surface from reusing the unsupported workflow.

### Retire the action and direct to declared intent

Pros:

- Keeps native creation platform-agnostic and server-authoritative.
- Makes an empty library explicitly non-evidence rather than a recovery task.
- Removes the full browser `sync -> refresh -> reload` chain.
- Preserves accessible, text-only guidance and the existing bounded mapping
  navigation behavior.

Cons:

- A profile-less library does not receive immediate observed suggestions.
- The operator must declare purpose or defer until stored evidence is current.

## Final Recommendation Stack

1. Make `new_library` use the existing `add_declared_intent` guidance action.
2. Remove `sync_media_server_library` and the `sync_library` action mode from
   native policy-authoring contracts.
3. Delete `usePolicyBuilderLibrarySync` and remove native workflow refresh
   result/progress handling from the modal and workflow shell.
4. Keep the server-owned persisted-policy recovery lifecycle automatic and
   retire profile regeneration from policy maintenance. A separate explicit
   Library Detail maintenance command remains available after intentional sync
   or metadata correction.
5. Keep only mapping navigation as an actionable empty-state transition, with
   its existing server-supplied busy label and accessible status announcement.

## Implementation Outcome

- `policyAuthoringDestinationFlow.mjs` now directs a new library to declared
  intent and explains that empty content is not destination evidence.
- `policyOperatorWorkflowEmptyState.mjs` projects the new-library state as
  actionless guidance. It no longer exposes a sync action mode or busy copy.
- `PolicyBuilderModal.vue` no longer imports a library-sync composable or
  chains library sync, profile refresh, workflow reload, toast, and focus
  recovery in native creation.
- `PolicyBuilderWorkflowShell.vue` and its status resolver no longer model
  native browser profile-refresh activity or its result. They retain loading,
  server errors, and bounded mapping-navigation status.
- `usePolicyBuilderLibrarySync.js` and its focused test are deleted. Workflow
  and boundary inventories no longer classify the retired file.
- The standalone readiness vocabulary no longer suggests manual profile sync
  or refresh; missing or stale observed evidence directs to declared intent
  while automatic recovery remains server-owned.

No API route, database schema, provider call, quota behavior, policy write,
routing operation, or persisted-policy recovery mechanism changed.

## Verification

- Focused Vue tests cover actionless new-library guidance, scoped mapping
  progress, and the absence of native browser refresh or sync controls.
- Focused server tests verify the destination-flow, workflow read, readiness,
  and boundary-inventory contracts.
- Full client and server test, typecheck, lint, and build gates remain required
  before release.

## Follow-On Outcome

The separate audit is implemented in [Library Profile Regeneration
Boundary](library-profile-regeneration-boundary.md). It removes the remaining
policy-builder and automatic-browser profile-refresh paths while retaining one
strictly validated read-write Library Detail maintenance command.
