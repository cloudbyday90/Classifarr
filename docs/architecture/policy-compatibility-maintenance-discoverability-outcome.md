# Compatibility-Policy Maintenance Discoverability and Profile Suggestion Outcome

## Scope

This document records the outcome for the unreleased follow-up to a misleading
compatibility-policy warning. It complements the design document rather than
altering release history; no release is created by this work.

## Delivered Outcome

- The policy lifecycle warning becomes actionable through a contextual
  administrator maintenance-review control for the affected policy.
- Reconciliation can receive that policy as a focus hint, so the administrator
  lands on the relevant maintenance record instead of searching an unlinked
  inventory.
- A modular, read-only suggestion service reuses the bounded current-profile
  contract to offer a genre-based **Belongs Here** draft only for the exact
  `no_convertible_intent` maintenance case.
- The existing compatibility editor makes the operator explicitly add that
  suggestion to an unsaved draft. Normal review and Save remain mandatory.
- No profile refresh, conversion, routing change, AI request, learning write,
  or background job is initiated by opening or accepting the suggestion.

## Security Outcome

The implementation preserves server-side administrator authorization, no-store
read semantics, positive policy-ID handling, bounded response fields, and
existing server validation on the only write route. Profile evidence is never
treated as policy authority by itself.

## Dependency PR Outcome

Open PR #519 was selected at random earlier in this workstream and implemented
locally as Vite 8.2.2 in commit `00cf012e`. It was tested locally and pushed
as part of the branch history; the pull request was not merged and no release
was created.

## Verification Outcome

The focused service and route tests passed: 5 suites / 28 tests. The focused
client tests passed: 10 files / 75 tests. After the full server suite exposed
the new component and presentation test as missing required inventory metadata,
the inventory audit was corrected and rerun successfully (2 suites / 20 tests);
the affected client UI suites then passed (4 files / 24 tests).

Server and client lint, documentation lint, server/client type checks, static
ESM-import and test-mock-shape checks, and a production client build passed.
The first full workspace run was deliberately stopped after the server phase
reported only those inventory omissions and its client phase had begun; it is
not represented as a fully green workspace run. Re-run `npm test` before a
release candidate or deployment promotion.

## Recommended Next Item

After deployment, use the new **Review policy maintenance** action for Kids
TV, inspect the profile-based purpose suggestion, and accept it only if its
genre boundary describes the intended future contents. Then observe the next
scheduler reconciliation run. If the profile's genres are too broad to state
the library's purpose safely, decline the suggestion and define the boundary
manually; a future enhancement could support a structured, operator-confirmed
purpose description without relaxing the authority boundary.
