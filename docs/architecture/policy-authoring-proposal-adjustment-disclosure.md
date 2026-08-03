# Policy Authoring Proposal Adjustment Disclosure

## Status

Implemented by Phase 4R.5.1. This is the first deliberately narrow slice of
the Phase 4R.5 exceptional-adjustment disclosure. It lets an operator narrow
the server-proposed purpose genres while preserving the automated proposal as
the normal default.

## Goal

An eligible library already has a profile-derived destination proposal. Asking
the operator to recreate known meaning adds decision load and weakens
automation. Some libraries still need a small correction before their first
policy is created, so the product provides an optional, collapsed adjustment
surface rather than reopening the legacy builder.

The implemented command is intentionally limited to:

```text
set_purpose_genres -> retain one or more genres already proposed from the current library profile
```

It cannot add values, use templates, set hard limits, alter review behavior,
configure routing, mutate an existing policy, or submit compatibility payload
fields.

## Research

- The [WAI-ARIA Authoring Practices disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  specifies a native button with `aria-expanded` for a collapsible disclosure.
  The normal path keeps the control collapsed; the control retains the stable
  accessible name `Adjust this policy` when closed.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires user-interface components
  to be programmatically determinable and operable. The disclosure uses native
  buttons and checkboxes, visible labels, keyboard-native control behavior, and
  a disabled final selected option so the minimum selection is understandable.
- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlisting and early validation. Browser validation
  is convenience only: the server repeats strict structural validation,
  normalizes strings, checks proposed values, and revalidates canonical intent.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends authorization and server-side enforcement for state-changing
  endpoints. Admission remains administrator-authorized, revision-bound,
  transactional, and idempotent; the browser never receives the canonical
  intent or authorization authority.

## Options Considered

### Reopen the full policy editor

Pros:

- Covers all policy controls in one surface.
- Familiar to operators of the old builder.

Cons:

- Requires operators to restate profile-derived meaning.
- Reintroduces browser-composed policy intent and unsupported controls before
  their server authority contracts exist.
- Makes the normal automated path a large form.

Rejected.

### Offer no adjustment before creation

Pros:

- Minimal UI and transport surface.
- No additional command validation.

Cons:

- Forces an operator to create an unwanted policy or abandon an otherwise safe
  proposal when one proposed genre is too broad.

Rejected.

### Collapsed, typed purpose-genre narrowing

Pros:

- Preserves one-click creation for the normal path.
- Uses values already derived from the current library profile.
- Has one bounded command, one source label, and an easily auditable
  server-side validation path.
- Gives a changed adjustment state its own idempotency attempt fingerprint.

Cons:

- Does not solve hard limits, review, routing, or custom evidence.
- A changed or expired proposal requires the existing authoritative lifecycle
  recovery rather than preserving a local selection.

Selected.

## Design

### Server authority

`policyAuthoringProposalAdjustmentContract.mjs` accepts zero or one transport
command. The only accepted command is `set_purpose_genres` with one through
twelve normalized, unique values. The service applies it only as a subset of
the sole `genres` `require_any` purpose rule from the persisted proposal.

Admission applies the command twice:

1. to the locked persisted proposal before idempotent replay; and
2. to the re-derived current candidate after the revision and profile checks.

If either application fails, admission returns the existing safe stale outcome.
The server creates the native policy only from the resulting validated
canonical intent.

The prepared response exposes only display-safe values and a source identifier:

```json
{
  "adjustment": {
    "purposeGenres": [
      { "value": "Animation", "sourceId": "current_library_profile" }
    ]
  }
}
```

### Client disclosure

`PolicyDestinationProposalAdjustmentDisclosure.vue` is absent unless the
strict proposal adapter validates one or more eligible options. It is collapsed
by default. When opened, it presents only source-labelled native checkboxes;
the last selected option cannot be cleared. Restoring the full proposed set
removes the adjustment command.

The client adapter accepts only the same command shape before turning it into
the snake-case REST payload. This prevents accidental expansion by later
components, but does not replace server validation.

### State and recovery

Adjustment state belongs to the active selected library and prepared proposal.
`PolicyList.vue` clears it when library selection, lifecycle selection, or
proposal revision changes, and the proposal card is rendered from the new
server projection. Existing stale, concurrent, and uncertain admission
recovery clears local proposal state and rereads the authoritative lifecycle.

## Recommendation Stack

1. Keep the prepared server proposal as the default and the disclosure
   collapsed.
2. Permit only revision-bound narrowing of current-profile purpose genres in
   this slice.
3. Validate the typed command in the client for safe UX, then resolve and
   validate it again on the server against the locked and current candidate.
4. Treat proposal revision changes and recovery outcomes as invalidation events
   for local adjustment state.
5. Implement additional signal groups only after their eligibility, source,
   and server admission contracts exist. Do not convert this disclosure into a
   general editor.

## Outcome

Eligible proposals now remain automated by default while allowing an operator
to exclude one or more profile-derived purpose genres before first creation.
The browser sends only a typed allow-listed command plus opaque proposal
identifiers and an idempotency key. The server verifies the command against
current authoritative intent, and all malformed, broadened, stale, or
out-of-scope changes fail closed.

## Next Slice

Phase 4R.5.2 will evaluate additional adjustment groups only where a concrete
server eligibility projection and typed admission command exist. It must add
source labels and disabled reasons without recreating the broad legacy policy
builder.
