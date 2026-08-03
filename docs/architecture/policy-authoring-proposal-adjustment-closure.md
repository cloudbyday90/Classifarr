# Policy Authoring Proposal Adjustment Closure

## Status

Phase 4R.5.3 is complete. This closure finalizes the bounded purpose-genre and
helpful-studio adjustment disclosure. It does not add another policy control or
expand browser authority.

## Goal

An adjustment is valid only for the server-prepared proposal that owns it. A
library change, proposal replacement, revision change, stale result, expired
result, or lifecycle recovery must therefore discard browser-local commands.

If authoritative lifecycle recovery again reports an eligible library, the
existing selection lifecycle prepares one fresh proposal. It never retries the
failed admission. The operator must still explicitly create the policy from
that new revision.

## Research

- The [WAI-ARIA disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  uses a native button and `aria-expanded`; native buttons supply the expected
  Enter and Space interaction.
- [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  requires a focus order that preserves meaning and operability. Expanded
  checkbox groups appear directly after their disclosure trigger.
- [WCAG 2.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
  supports native controls and programmatically determinable names and states.
  The disclosure links its heading and description by generated IDs, while
  each related set remains a native `fieldset` with a `legend`.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports keeping authorization and validation at the endpoint. The browser
  sends no new policy meaning and does not decide whether recovery permits a
  write.

## Options Considered

### Retain adjustments until the operator changes them

Pros:

- Avoids reselecting an optional narrowing after a transient outcome.

Cons:

- Associates selections with a proposal revision that may no longer exist.
- Risks applying an old subset to a new profile-derived candidate.

Rejected.

### Store adjustments in browser storage and resume after reload

Pros:

- Preserves a local draft across navigation and reloads.

Cons:

- Extends the lifetime and authority of untrusted browser state.
- Creates cross-session and cross-tab ambiguity for opaque server proposals.

Rejected.

### Clear local commands and follow the authoritative lifecycle

Pros:

- Makes the prepared proposal revision the sole owner of adjustment state.
- Reuses the server-confirmed lifecycle and existing preparation path.
- Does not retry an admission or broaden the create contract.

Cons:

- An operator may need to make an optional narrowing again on a fresh
  proposal.

Selected.

## Design

`usePolicyAuthoringProposalAdjustmentState.js` owns only normalized, typed
commands for the current prepared proposal. Its `clear` operation runs when
the selected library, lifecycle selection, or proposal revision changes and
before outcome reconciliation. Invalid component input fails closed to an
empty command list.

The proposal outcome recovery composable remains read-only. It reloads the
selected library lifecycle and returns no proposal data. The existing lifecycle
selection watcher makes exactly one fresh prepare request when that reload
transitions the selected library back to `eligible_to_prepare_proposal`; no
second explicit prepare request is issued and no admission is retried.

The disclosure remains collapsed unless there are at least two eligible values
in a group. It uses:

- a native button with `aria-expanded` and an ID-linked description;
- `aria-controls` only while its rendered target exists;
- one native `fieldset` and `legend` for each admitted group; and
- native checkboxes, retaining browser keyboard behavior without custom roles.

## Verification

Focused component and view tests cover:

- canonical command normalization and fail-closed clearing;
- selection changes between libraries;
- both `proposal_stale` and `proposal_expired` reconciliation to a fresh,
  revision-bound proposal with no retained commands; and
- generated disclosure relationships and native checkbox grouping.

The browser test enters the disclosure with Enter, changes one purpose value
and one helpful-studio value with Space, verifies both named groups, and
asserts the admission payload contains only the two typed narrowing commands.

## Recommendation Stack

1. Keep adjustment state ephemeral, normalized, and scoped to one prepared
   proposal revision.
2. Clear it before every lifecycle recovery; prepare again only through the
   server-confirmed eligible lifecycle transition.
3. Never persist adjustments, retry admission, or reconstruct policy intent in
   the browser.
4. Prefer native button, `fieldset`, `legend`, and checkbox semantics over
   custom interactive roles.
5. Do not admit further adjustment groups until their server authority,
   profile source, and current-candidate validation are available.

## Outcome

The normal policy-authoring route remains automated and collapsed by default.
Optional narrowing cannot survive into another library or proposal revision,
and stale or expired outcomes resolve through the server lifecycle without
duplicate preparation or a blind create retry. Keyboard and assistive-technology
semantics are now exercised against the rendered application.

## Next Task

**Phase 5R.3 AI Provider Capability And Authority Modes:** establish bounded
provider authority before runtime clarification, learned decisions, or material
exception controls are introduced.
