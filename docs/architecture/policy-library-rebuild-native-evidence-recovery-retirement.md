# Policy Library-Rebuild Native Evidence Recovery Retirement

## Status

Implemented as Phase 6R.6 Task 6R.6.11.1.

This record retires the native-create browser recovery component and its client
state utility. Native policy creation no longer offers a refresh-profile or
reload-workflow action when observed evidence is unavailable, stale, empty, or
when the display read fails. Server-owned profile recovery remains responsible
for establishing and refreshing observed library evidence.

## Problem

The retired component let an operator invoke a browser-side profile refresh or
repeat the workflow read before selecting observed values. That contradicts the
destination-first automation model: profile collection and recovery are
server-owned lifecycle work, while the browser should display current evidence
and accept explicit policy intent only when usable candidates already exist.

The component also duplicated server recovery state in a client-only status
vocabulary. Keeping it would create a second source of truth and leave native
creation dependent on an operator action that differs by browser session.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege and deny-by-default. Removing the browser action
  eliminates an unnecessary client path that could request profile work from a
  policy-authoring session.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  describes controlled, monitored configuration state. The UI now reads the
  current server projection instead of maintaining a parallel recovery model.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small, quality-gated changes. This is a narrow component-family
  deletion with targeted tests, build validation, and a reversible source
  commit; it does not change persisted policy state or routing behavior.

## Options Considered

### 1. Keep refresh and retry controls in native creation

Pros:

- An operator can request another attempt immediately.

Cons:

- Preserves a manual browser dependency in an automated lifecycle.
- Duplicates recovery state and behavior outside the server-owned circuit.

### 2. Hide the buttons but retain the client recovery utility

Pros:

- Smaller visual change.

Cons:

- Retains dead state vocabulary, tests, and a false second authority.

### 3. Retire the component family and render only current server projection

Pros:

- Keeps profile recovery platform-agnostic and server-owned.
- Shows observed signal controls only for current, selectable projections.
- Removes client refresh/reload behavior without changing routing or save
  authorization.

Cons:

- An operator waits for the server lifecycle instead of forcing a browser
  retry.
- Existing empty-state actions remain a separate concern and require their own
  retirement decision.

## Final Recommendation Stack

1. Delete `PolicyNativeEvidenceRecovery` and its utility, tests, imports, and
   client-side action emits.
2. Let the destination question render observed signal controls only when the
   server projection has selectable options, or when server-admitted custom
   entry is available.
3. Keep workflow loading, bounded error, automatic refresh-progress, and
   completed refresh-result announcements in the one workflow status resolver.
4. Keep library sync and routing mapping as separate empty-state decisions;
   they are not reintroduced as native evidence-recovery controls.
5. Remove the retired paths from the outstanding legacy-removal inventory so
   future release gates fingerprint only remaining candidates.

## Implementation Outcome

- Removed `PolicyNativeEvidenceRecovery.vue`,
  `policyNativeEvidenceRecovery.js`, and their component/utility tests.
- Removed native-create refresh/reload events and the modal workflow reload
  handler.
- Simplified the destination-question picker gate to current selectable server
  options or server-admitted custom entry.
- Simplified workflow status priority to loading, server error, active
  empty-state work, profile refresh progress, and completed refresh result.
- Removed the retired files from `policyMigrationDeletionPath.mjs` and updated
  its deletion-path regression expectation.
- Removed the obsolete presentation-test inventory record.

No route, API handler, database migration, scheduler, provider request,
filesystem action, policy write, routing change, or repository-write runtime
capability was added.

## Verification

- Focused Vue tests cover no native recovery/reload buttons for unavailable or
  stale evidence, server-projected selectable values, and single live status
  behavior.
- Focused server tests cover the updated deletion inventory and presentation
  test inventory.
- Client production build verifies there are no deleted-module imports.

## Next Task

Phase 6R.6 Task 6R.6.11.2 is **Browser Impact And Replay Preview Retirement**.
It should remove the still-classified impact/replay cards, composables,
utilities, and their tests from the policy-authoring bundle while retaining the
server-side bounded migration verifier outside the normal workflow.
