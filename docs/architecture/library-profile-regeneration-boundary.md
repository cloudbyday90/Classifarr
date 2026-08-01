# Library Profile Regeneration Boundary

## Status

Implemented on July 31, 2026.

## Problem

Library-profile generation is server-owned lifecycle work. Startup generation,
the native policy profile-refresh outbox, and reconciliation recovery already
generate the stored profile without requiring an open browser.

Two browser paths blurred that boundary:

- the policy builder let a compatibility-maintenance user regenerate a profile;
  and
- Library Detail automatically posted a regeneration request whenever its
  profile read returned `404`.

The first made observed evidence mutation part of policy authoring. The second
turned a normal read into an implicit write whose execution depended on an
operator viewing a page. Neither path should establish or recover policy
authority.

## Official Guidance Reviewed

Research was reviewed on July 31, 2026, against the requested current-through-
June-2026 baseline:

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires server-side validation and authorization for state-changing
  endpoints. The regeneration route accepts only a strict positive library ID
  and remains behind the existing `requireReadWrite` middleware.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default behavior, and authorization on
  every request. The read-only policy builder no longer receives a mutation
  command; a separate read-write library-maintenance endpoint retains the
  authorized command.
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports programmatically determinable asynchronous status without moving
  focus. Library Detail exposes regeneration progress and result text through
  scoped `role="status"` and errors through `role="alert"`.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for clear interface ownership and verification. The focused client and
  server tests separately prove automatic read behavior, explicit mutation,
  strict request validation, and retained authorization wiring.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep profile refresh in policy maintenance | Immediate manual recovery from the current modal | Lets policy authoring mutate observed evidence and makes normal authoring depend on browser state. |
| Keep automatic `404` regeneration in Library Detail | Makes an empty detail card appear self-healing | A GET view produces a privileged write, repeats on page visits, and bypasses an explicit operator decision. |
| Retire all manual regeneration | Smallest mutation surface | Removes a useful read-write maintenance action after intentional sync or metadata correction. |
| Keep one explicit Library Detail regeneration command | Separates normal automation from bounded maintenance, preserves a controlled operator fallback, and keeps policy authoring read-only | A read-write operator still must consciously request exceptional regeneration. |

## Decision

Adopt the explicit Library Detail regeneration command and retire both
policy-builder and automatic-browser refresh paths.

1. `GET /libraries/:id/profile` is a read-only observed-evidence read.
2. `POST /libraries/:id/profile/refresh` remains a read-write maintenance
   endpoint, but validates the route value as a strict positive safe integer
   before it reaches `LibraryProfileService`.
3. `PolicyBuilderModal.vue`, `PolicyBuilderLibraryContext.vue`, and
   `usePolicyBuilderReferenceData()` no longer expose, route, summarize, or
   retain profile regeneration state.
4. `LibraryProfile.vue` uses `useLibraryProfileMaintenance.js`, a focused
   composable that reads profiles without side effects and invokes regeneration
   only after the operator presses **Regenerate profile**.
5. The client API names the command `regenerateLibraryProfile` so callers do
   not mistake it for ordinary data loading.

The server lifecycle remains responsible for normal automation. This decision
does not alter media sync, provider use, TMDB quota handling, profile outbox
processing, reconciliation, policy persistence, routing, or learning.

## Security And Accessibility Outcome

- Route values such as `1abc`, `0`, and negative or unsafe integers cannot be
  coerced into another library ID.
- Regeneration remains an authenticated read-write request; the policy builder
  has no profile-mutation capability.
- A missing profile is treated as server-managed lifecycle state and never
  causes a client-side `POST` during page load.
- Regeneration rereads the stored profile after a successful write rather than
  rendering a transient generator response as profile authority.
- Status and error messages are scoped to Library Detail and do not steal
  focus from the maintenance action.

## Verification

- `client/src/__tests__/composables/useLibraryProfileMaintenance.test.js`
  verifies no `404` read triggers regeneration, explicit regeneration rereads
  the stored profile, and failure is bounded.
- `client/src/__tests__/LibraryProfile.test.js` verifies the accessible
  maintenance control and status feedback.
- `client/src/__tests__/PolicyBuilderLibraryContext.test.js` and
  `client/src/__tests__/composables/usePolicyBuilderReferenceData.test.js`
  verify policy authoring has no profile mutation control.
- `server/src/__tests__/integration/library-profile-integration.test.mjs`
  verifies strict IDs, the retained read-write route, and the server-managed
  missing-profile response.

## Final Recommendation Stack

1. Keep automatic profile generation and recovery server-owned.
2. Keep profile evidence read-only in every policy-authoring surface.
3. Retain one explicit, read-write Library Detail regeneration command for
   intentional maintenance only.
4. Validate route identifiers before loading or mutating profile data.
5. Use scoped, accessible status feedback instead of implicit background writes
   or focus changes.

## Next Item

Proceed with **Phase 3R.3 UI Component System And Interaction Reset**, starting
with the component inventory and target ownership map. It is the next roadmap
slice that can simplify the remaining policy-authoring surfaces without adding
another browser-owned workflow.
