# Policy Authoring Empty-State Mapping

Status: implemented for the destination-first policy workflow.

## Scope

This record defines the safe, operator-facing behavior when the policy builder
does not have enough stored library context to establish a destination. It
covers only the bounded workflow read, declared-intent guidance, and the one
existing navigation resolution action. It does not infer policy intent, route
media, call a provider, trigger library synchronization, or expose a
profile-loader failure as a library state.

## Official Guidance Reviewed

- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires important state changes to be programmatically determinable without
  an unexpected focus change. The resulting action outcome is concise and uses
  the existing polite status treatment.
- [W3C WCAG 2.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  supports clear instructions that explain the expected operator action without
  overwhelming the screen with implementation detail.
- [W3C WCAG 2.2: Change on Request](https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html)
  supports predictable interaction. A missing profile now changes only the
  displayed guidance; it does not cause an implicit browser-side sync or
  refresh request.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports precise interfaces, input validation, and verification for security
  controls. The projection is server-owned, audited, and tested as a bounded
  contract rather than inferred by the browser.

## State Contract

The workflow read returns `policy.operator_workflow_empty_state.v1` alongside
its existing display projection. Each state has one fixed question placement,
one action identifier, one target, and an explicit action mode.

| State | Detection | Question | Next action | Active feedback | Behavior |
| --- | --- | --- | --- | --- | --- |
| New library | Persisted profile is specifically absent | What belongs here? | Add declared intent | No busy state because this is guidance, not an action. | Explain that an empty library is not evidence. The operator may declare purpose or defer; later persisted-policy recovery remains server-owned. |
| Sparse library | A current, valid profile has no usable observed suggestions | What belongs here? | Add declared intent | No busy state because this is guidance, not an action. | Show bounded guidance only. Classifarr does not invent purpose or render a control that cannot persist safely. |
| Unmapped library | The stored Arr mapping is absent or not route-ready | Can this route? | Open library mapping | `Opening library mapping...`; a polite status describes the navigation. | Open the existing library detail mapping workflow, then close the policy modal. No media is routed. |

A profile load failure, invalid evidence, or blocked evidence boundary is not a
new library. Those remain evidence-recovery outcomes so the browser cannot
mistake an unavailable read for a request to synchronize a library.

## Options Considered

### Infer empty states in the browser

Pros:

- Small initial client change.
- No server response extension.

Cons:

- Duplicates profile-status and routing semantics across clients.
- Cannot reliably distinguish a missing profile from a failed profile read.
- Lets UI code decide which write or navigation operation is allowed.

### Render static next-action text only

Pros:

- No new API shape.
- Minimal visible surface.

Cons:

- Leaves the only real actions hidden in unrelated screens.
- Encourages labels that look like controls but do nothing.
- Does not prove that an action still matches the policy-authoring contract.

### Server-owned state projection with bounded action modes

Pros:

- Keeps state classification and action identity in one audited service layer.
- Distinguishes unavailable evidence from an empty library safely.
- Keeps profile lifecycle work outside the browser and reuses the existing
  mapping screen only for routing configuration.
- Keeps sparse evidence non-automatic and avoids non-functional buttons.

Cons:

- Adds a small response projection and focused client components.
- The sparse-library declared-intent control remains a later component task.

## Final Recommendation Stack

1. `server/src/services/policyOperatorWorkflowEmptyState.mjs` owns the
   state-to-question, state-to-action, and actionable busy-label mapping,
   plus an audit that rejects unknown, duplicate, misrouted, altered, or
   diagnostic-bearing states.
2. `server/src/services/policyOperatorWorkflowReadService.mjs` appends that
   read-only projection after it builds bounded observed-profile data.
3. `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
   renders guidance as text and emits only validated actionable records. It
   does not persist, refresh, synchronize, or route media.
4. `client/src/components/policies/PolicyBuilderModal.vue` tracks one active
   navigation action ID and closes only after navigation to the existing
   library mapping page succeeds.

## Outcome

New, sparse, and unmapped destinations now carry one visible, bounded next
action in the question that explains the condition. A new library and sparse
evidence both direct the operator to declared-intent guidance rather than
creating a browser recovery operation. Empty library state never becomes
inferred identity, and unmapped destinations navigate to configuration rather
than attempting a route. While navigation is active, only that action receives
its state-owned busy label and one workflow-level polite progress message.

## Next Step

Begin Phase 3R.3 by replacing the current workflow shell's generic context and
notice composition with the target `DestinationContextCard`,
`ObservedProfileSummary`, and `ReadinessNextActionCard` component vocabulary.
