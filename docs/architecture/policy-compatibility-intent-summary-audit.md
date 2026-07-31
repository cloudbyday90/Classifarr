# Policy Compatibility Intent Summary Audit

## Status

Implemented on 2026-07-31 as Phase 6R.5 compatibility maintenance work.

## Decision

Delete the compatibility-only `PolicyIntentSummaryCard.vue` and
`policyIntentSummary.js` helper. Do not replace them with a reduced card or a
compatibility summary API.

The summary was calculated from an unsaved browser draft and repeated the
configured signals already presented by the intent editor. Its `Needs review`
and `Looks complete` labels made local display logic appear to determine policy
behavior and automation state. Compatibility maintenance now renders only the
editor's labelled controls and configured-signal chips. The existing write
endpoint remains the authority for authorization and validation.

## Scope Classification

| Surface | Decision | Reason |
| --- | --- | --- |
| Global policy-behavior heading and section cards | Delete | Repeats the same draft signals next to their editable controls. |
| Draft-derived warning state | Delete | A browser draft cannot establish policy validity, review, or automation state. |
| Generated policy-effect descriptions | Delete | They interpret unsaved data rather than describe an immediate control action. |
| Intent-editor labels, controls, and configured-signal chips | Keep | They identify the current value and the concrete operator action. |
| Compatibility save endpoint and server validation | Keep | Authorization and semantic validation remain at the trusted write boundary. |
| Native persisted-policy summary | Keep separate | It is server-read persisted state, not a compatibility-draft interpretation. |

## Official Guidance Reviewed

Research was reviewed on 2026-07-31 against official guidance current through
June 2026:

- [W3C WAI: Understanding Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
  states that instructions must provide needed cues without clutter; too much
  information can be as harmful as too little. The editor retains direct labels
  and removes the repeated summary.
- [W3C WAI: Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
  recommends associated labels that state each control's purpose. The retained
  controls and configured-signal chips continue to provide the relevant
  context at the point of editing.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  warns against relying on UI step gating. Browser-drafted warnings cannot
  authorize, reject, or otherwise decide a compatibility write.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side semantic validation before application processing.
  Removing the client summary does not alter the existing server validation
  boundary.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Retain the current summary | Familiar high-level scan | Duplicates controls and presents draft-derived behavior as policy state. |
| Replace it with smaller summary copy | Less visual weight | Still duplicates the editor and requires choosing which local interpretation remains. |
| Add a server compatibility-summary API | Could use persisted data | Is stale while editing and creates a new read contract without changing write authority. |
| Delete the summary and retain direct controls | One draft representation with less decision load | No separate global recap, by design. |

## Final Recommendation Stack

1. Keep compatibility maintenance focused on the controls that change intent.
2. Use labelled configured-signal chips as the single browser representation of
   the unsaved compatibility draft.
3. Keep compatibility authorization and semantic validation on the server.
4. Keep automation readiness only in the native persisted-policy projection.
5. Do not add a compatibility summary API, draft-evaluation endpoint, or new
   browser policy-behavior model.

## Implementation Outcome

- Deleted `PolicyIntentSummaryCard.vue`, `policyIntentSummary.js`, and their
  focused tests.
- Removed the summary prop and draft computation from the compatibility modal
  path.
- Updated client and server inventory records so deleted artifacts are not
  classified as active workflow or presentation surfaces.
- Preserved typed compatibility draft commands, the save footer, the existing
  serializer, and server-side write validation.

## Security And Accessibility Outcome

- Unsaved browser state cannot claim policy completeness, review behavior, or
  automation readiness.
- No request, permission, persistence, provider, routing, or quota behavior was
  added or broadened.
- Every retained edit control continues to have direct local label and action
  context without a competing aggregate status region.

## Verification

Focused modal and maintenance-surface tests confirm that the direct intent
editor remains available while the behavior summary is absent. Server
inventory tests confirm that no deleted summary artifact remains active. Full
client tests, coverage, build, lint, type checking, server checks, and
documentation lint are release gates.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
Next, perform a **compatibility setup-card grid retirement audit** for
`client/src/components/policies/PolicyBuilderSetupCards.vue` and
`policyBuilderSetupCards.js`. Confirm the grid remains unmounted, then remove
it rather than preserve stale anchors or browser-derived readiness state.
