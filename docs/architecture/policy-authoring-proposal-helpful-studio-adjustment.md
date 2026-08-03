# Policy Authoring Proposal Helpful-Studio Adjustment

## Status

Implemented by Phase 4R.5.2.1. This adds the only additional adjustment group
that currently meets the create-time admission requirements: a bounded
narrowing of helpful studio preferences proposed from the current library
profile. Phase 4R.5.3 completes the reset and accessibility closure; see
[Policy Authoring Proposal Adjustment Closure](policy-authoring-proposal-adjustment-closure.md).

## Goal

The prepared proposal remains the automatic default. An operator should only
intervene when a profile-derived helpful studio does not describe the intended
destination. The adjustment must not turn a helpful preference into identity,
add a value, or expose a general editor.

## Eligibility Decision

| Candidate group | Server profile source | Typed command | Current-candidate recheck | Decision |
| --- | --- | --- | --- | --- |
| Purpose genres | `purpose.genres.require_any` | `set_purpose_genres` | Yes | Retained from 4R.5.1 |
| Helpful studios | `helpful_hints.studios.prefer` | `set_helpful_studios` | Yes | Implemented |
| Media type | One profile-derived value | No meaningful narrowing | Not applicable | Do not render |
| Hard limits and avoid values | No proposal-derived source | No dedicated command | No | Excluded |
| Review, routing, templates, and custom input | No create-time authority contract | No | No | Excluded |

`policyLibraryProfileInitialIntent.mjs` limits the profile-derived studio
source to its top three values. The adjustment contract repeats that bound and
allows only retaining one or more proposed values.

## Research

- [W3C grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends native `fieldset` and `legend` elements for related controls.
  Each adjustment group is therefore a separately named native checkbox group.
- The [WAI-ARIA checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  describes keyboard expectations for checkboxes. Native checkboxes preserve
  that behavior without custom ARIA state management.
- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlists and semantic validation. The browser accepts only the
  server-projected source identifier and the server repeats validation against
  the persisted and re-derived candidate.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends endpoint-specific authorization and strict request validation.
  The existing admin-authorized, revision-bound, transactional admission
  endpoint remains the sole write boundary.

## Options Considered

### Add every visible policy group

Pros:

- Appears comprehensive.

Cons:

- Recreates browser-authored policy intent and an advanced-settings workflow.
- Exposes values without a profile source or server admission contract.

Rejected.

### Add no further groups

Pros:

- Preserves the smallest UI surface.

Cons:

- Cannot correct a profile-derived helpful preference before first creation.

Rejected.

### Add only helpful-studio narrowing

Pros:

- Uses the same current-profile source, opaque proposal revision, and
  server-side recheck as the existing genre adjustment.
- Keeps helpful evidence distinct from destination identity.
- Has a fixed three-value bound and one typed command.

Cons:

- Does not cover limits, review, routing, templates, or custom evidence.

Selected.

## Design And Outcome

The server projects `helpfulStudios` only from the sole `studios` `prefer`
rule in the prepared canonical intent. The UI remains absent for a group with
zero or one option, remains collapsed by default, and uses one native
`fieldset` per eligible group. The final selected value is disabled because an
adjustment is narrowing-only.

The client emits canonical typed commands in a fixed order:

```text
set_purpose_genres
set_helpful_studios
```

The server rejects unexpected commands, duplicate groups, added values, empty
sets, oversized sets, invalid source shapes, stale revisions, and candidates
that no longer contain the selected value. It applies valid commands first to
the locked proposal and again to the re-derived current candidate before
native policy creation. The presentation adapter also fails closed when any
supplied option does not pass strict source and shape validation.

## Recommendation Stack

1. Keep the prepared policy proposal and creation action as the normal path.
2. Permit only profile-derived, subset-only purpose and helpful-studio
   adjustments before first creation.
3. Keep helpful studios advisory; never describe or process them as identity.
4. Require a dedicated server source, typed command, bounded allowlist, and
   current-candidate recheck before admitting another group.
5. Complete local-state reset and end-to-end accessibility coverage before
   expanding the disclosure again.

## Next Task

**Phase 5R.3 AI Provider Capability And Authority Modes:** establish bounded
provider authority before runtime clarification, learning, or material policy
exceptions are introduced.
