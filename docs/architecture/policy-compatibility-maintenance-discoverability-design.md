# Compatibility-Policy Maintenance Discoverability and Profile Suggestion Design

## Status

Implemented for the current unreleased worktree. This design addresses the
operator experience where a library reports **Existing policy needs
maintenance** but gives no visible path to the actionable maintenance view.

## Problem

The policy lifecycle list correctly prevents a second policy from being
created for a library with a compatibility policy. It previously exposed that
state only as a warning. The native-intent reconciliation view existed at a
direct URL but was not linked from the lifecycle outcome, leaving an
administrator unable to discover the next action.

The platform also has a bounded profile-derived proposal contract for a new
policy, but legacy maintenance did not expose that evidence. An administrator
could see neither a clear explanation nor a reviewable profile-based starting
point for the missing declared purpose.

## Official-Source Research

Research was performed on 2026-08-28 using the official sources below.

- [W3C WCAG 2.2, Understanding Success Criterion 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires status changes to be programmatically determinable so assistive
  technology can announce them without moving focus. The implementation keeps
  loading, error, and draft-added feedback in live status regions and moves
  focus only after an intentional route transition.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends default-deny access and authorization checks on every request.
  The UI action is only a convenience; each reconciliation read endpoint
  independently requires an administrator.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist validation. The implementation accepts no
  client-provided profile or rule payload for the suggestion endpoint, bounds
  the server projection, and validates the locally accepted rule before it can
  enter an unsaved draft.
- [GitHub REST API documentation for pull requests](https://docs.github.com/en/rest/pulls/pulls?apiVersion=latest)
  documents filtering by `state=open`. It informed the earlier selection of
  open PR #519, whose Vite 8.2.2 update was implemented locally without merging
  the pull request.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add a permanent global maintenance navigation item | Easy to find | Shows an exceptional, administrator-only screen to people with no pending work | Rejected |
| Keep an unlinked direct route | No UI change | Leaves the warning non-actionable and forces users to know an internal URL | Rejected |
| Automatically promote profile evidence to a policy rule | Lowest operator effort | Treats observed contents as policy authority and can silently redefine a destination | Rejected |
| Let the browser derive a rule from the full profile | Avoids an endpoint | Duplicates profile interpretation and lets client state become an authority boundary | Rejected |
| Contextual maintenance action plus a read-only server profile suggestion | Direct, understandable, bounded, and explicitly approved before save | Adds a narrow endpoint and a small draft-acceptance path | Adopted |

## Adopted Design

### Discoverability

For the `existing_compatibility_policy` lifecycle state, the server returns a
specific, available `review_reconciliation` action. The client validates that
contract, renders **Review policy maintenance** beside the affected library,
and navigates to the existing reconciliation route with the policy identifier
as a focus hint. The reconciliation inventory focuses the matching record once
its server-owned data has loaded.

This is a contextual action, not a replacement conversion control. The
reconciliation page continues to own the only maintenance inventory and the
scheduler continues to own conversion.

### Profile-Based Purpose Suggestion

A new modular service composes the existing
`policyLibraryProfileInitialIntent` contract with a policy-specific,
read-only persistence query. It provides a suggestion only when all of these
facts hold:

1. The requested policy exists and has no active native authority.
2. Its current reconciliation state is exactly
   `requires_maintenance` / `no_convertible_intent`.
3. A current, sufficient library profile produces a supported genre-purpose
   rule.

The projection contains only the bounded profile summary and the supported
genre values needed for review. It excludes raw media items, paths, complete
profile JSON, legacy policy JSON, credentials, AI output, routing state, and
learning data. It performs no writes, profile refreshes, provider calls, AI
calls, scheduling changes, or conversion.

The administrator opens the established policy editor from the reconciliation
record. The editor shows the profile projection as a suggestion, not as a
policy rule. **Add suggested rule to draft** is available only for a policy
with one editable policy context. Clicking it updates the local, unsaved
compatibility draft. The operator must still inspect the ordinary destination
editor and use its existing Save action. The normal server update validation
remains the only persistence path.

### Security and Authority Properties

- Every suggestion request requires an administrator; browser route and query
  state grant no authority.
- The server derives policy, library, reconciliation state, and profile from
  the requested policy ID. It does not accept those values from the client.
- Only allowlisted, bounded genre-purpose values leave the service boundary.
- Profile evidence is advisory until the operator explicitly adds it to a
  draft and subsequently saves through the existing validated update route.
- Saving the draft does not convert the policy. The protected scheduler
  independently re-evaluates the new policy configuration.
- The implementation is ESM throughout and keeps the persistence, contract,
  service, client adapter, and presentation components separate.

## Acceptance Criteria

1. A compatibility-policy lifecycle card has a visible maintenance review
   action; native-policy and profile-recovery cards do not gain that action.
2. The direct action carries the affected policy to the reconciliation
   inventory and exposes a focused, labeled record.
3. A non-administrator receives `403` for the suggestion endpoint.
4. The endpoint is read-only and exposes no raw profile or legacy-policy
   payload.
5. Missing, stale, insufficient, non-actionable, or already-native policies
   cannot produce an available suggestion.
6. Explicitly accepting a valid suggestion changes only an unsaved local
   draft; it does not trigger a save, reconciliation run, AI call, routing
   decision, or learning write.
7. Focused server and client tests cover the contract, route authorization,
   lifecycle action, draft acceptance, and accessible status feedback.
