# Policy Native Pending-Question Presentation

## Status

Implemented for canonical `policy.runtime_question_persistence.v1` pending
questions in the Command Center and Discord notifications.

## Problem

The persistence admission bridge intentionally preserved the older pending-item
shape so it could reuse the existing transaction and notification paths. The
generic browser panel consequently treated a native runtime question as a
legacy question: it rendered `Confirm`, `Change`, `Retry Classification`, and
then every stored option. That exposed duplicate actions and made an
outcome-only `do_not_learn` choice look like a missing library mapping.

Discord had the same semantic gap. Its generic buttons exposed stored labels
instead of the normalized action meaning, while its established manual
correction path is not appropriate for native question outcomes because it can
trigger legacy correction behavior.

## Official Guidance Reviewed

- [WAI-ARIA Authoring Practices: Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  describes buttons as discrete actions with clear names and expected keyboard
  behavior. Native rendering uses one explicitly named button per permitted
  outcome rather than duplicating generic and option-derived controls.
- [WCAG 2.2 Understanding SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires non-focus-changing status updates to be programmatically
  determinable. The existing Command Center live alert remains the single
  announced result/error surface; native action controls do not introduce a
  second competing alert region.
- [Discord: Using Message Components](https://docs.discord.com/developers/components/using-message-components)
  documents structured action rows and button `custom_id` handling.
  [Discord Component Reference](https://docs.discord.com/developers/components/reference)
  requires interactive component custom IDs to be unique within a message.
  Native buttons preserve the classification-and-option-index ID shape already
  routed by the authoritative handler.

## Design

```text
canonical persisted native envelope
  -> presentation adapter validates version, outcomes, and destination binding
       -> browser: two outcome buttons + alternate-destination entry point
       -> Discord: two outcome buttons + explicit web-app alternate guidance
  -> existing authoritative resolver
       -> verifies active compatible library and stale state
       -> records final outcome
       -> suppresses native legacy rule generation
```

`server/src/services/policyNativePendingQuestionPresentation.mjs` owns the
server-side projection used by Discord. It accepts only a complete canonical
envelope with exactly usable `resolve_current_item` and `do_not_learn` actions,
and verifies that the first option is bound to the persisted server-owned
destination. Malformed native-looking records fail closed to retry-only
guidance rather than receiving a legacy presentation or destination fallback.

`client/src/utils/nativePendingQuestionPresentation.js` is a matching
presentation-only browser projection. It does not decide validity, learning,
routing, persistence, or destination authority. The API resolver remains the
authority for all results.

`NativePendingQuestionActions.vue` displays only:

1. `Resolve in <destination>`.
2. `Resolve without learning`.
3. `Choose another destination`.
4. A separate retry action.

The alternate browser path reveals the existing compatible-library selector.
The native resolver already permits compatible manual destinations and forces
`generate_rule: false` for a native envelope. Discord explicitly directs that
alternative to Classifarr instead of reusing the legacy Discord correction
workflow, which has different learning semantics.

`Confirm All` excludes native pending questions. Bulk confirmation cannot turn
an explicit `do_not_learn` decision into an implicit default outcome.

## Security And Behavior Guarantees

1. Presentation data is derived only from the persisted canonical envelope.
2. The browser never supplies a native destination from a label; it uses the
   server-persisted destination projection and the server revalidates it.
3. Native resolution payloads send `generate_rule: false`; the server also
   independently ignores legacy rule generation for a native envelope.
4. Manual alternate destinations remain subject to server-side active-library,
   media-type, stale-question, and transaction checks.
5. Malformed native presentation data does not receive a relaxed destination
   fallback.
6. Discord button IDs retain their existing bounded classification and option
   identity; labels are display-only and cannot authorize an outcome.
7. No provider call, quota operation, library profile mutation, or policy
   learning is performed by either presentation adapter.

## Recommendations

1. Keep native and legacy pending-question presentation separate until the
   compatibility envelope is deleted.
2. Keep the two native outcomes explicit and do not restore generic `Confirm`
   or option-list controls for native envelopes.
3. Keep bulk actions away from native pending questions unless they can prove a
   single explicit outcome for each item.
4. Do not route Discord alternate destinations through legacy correction code;
   add a dedicated authoritative interaction only when that feature has its own
   outcome and learning admission tests.
5. Preserve one Command Center status/error announcer instead of nesting local
   live regions in every pending-item control.

## Pros And Cons

Pros:

- Makes the outcome-only contract visible at the decision point.
- Removes accidental legacy rule-generation and duplicate action paths.
- Keeps browser and Discord behavior aligned without adding another write path.
- Retains accessible, clearly named button actions and a single status surface.

Cons:

- The browser and server have small matching projections because they run in
  separate deployment boundaries.
- Discord alternate-destination selection remains intentionally web-app only
  until a dedicated authoritative interaction flow is built.
- The compatibility envelope still needs both normalized and legacy-readable
  fields until the storage deletion gates are complete.

## Final Recommendation Stack

1. `policyRuntimeQuestionPersistenceAdmission.mjs` creates the canonical
   native envelope.
2. `policyNativePendingQuestionPresentation.mjs` validates and projects server
   presentation actions for Discord.
3. `nativePendingQuestionPresentation.js` projects the same bounded browser
   actions without adding authority.
4. `NativePendingQuestionActions.vue` renders explicit action labels and the
   browser alternate-destination entry point.
5. `useNeedsAttentionActions.js` forces native resolutions to remain
   outcome-only and excludes them from bulk confirmation.
6. `clarificationPolicyResolution.mjs` remains the final server authority for
   destination validity, transaction state, normalized selection provenance,
   and outcome recording before routing.

## Verification

- Server focused Jest: native presentation, Discord notification, and Discord
  interaction suites pass (`45` tests).
- Client focused Vitest: native projection and Command Center action suites
  pass (`20` tests).
- Coverage includes malformed native presentation rejection, explicit browser
  actions, no generic duplicate controls, browser `do_not_learn`, manual
  alternate resolution, native Discord button labels, and authoritative Discord
  destination fallback.

## Next Step

The native pending-resolution provenance adapter is now implemented in
[Policy Native Pending-Resolution Provenance](policy-native-pending-resolution-provenance.md).
It records the normalized selected outcome and any alternate destination before
routing starts, passes the event through the learning guard, and keeps it
outcome-only. The remaining boundary is to append actual route results without
conflating them with selection or classification resolution.
