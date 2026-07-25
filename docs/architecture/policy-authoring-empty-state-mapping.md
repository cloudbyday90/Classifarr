# Policy Authoring Empty-State Mapping

Status: implemented for the destination-first policy workflow.

## Scope

This record defines the safe, operator-facing behavior when the policy builder
does not have enough stored library context to establish a destination. It
covers only the bounded workflow read and the two existing, explicit resolution
actions. It does not infer policy intent, route media, call a provider, or
expose a profile-loader failure as a library state.

## Official Guidance Reviewed

- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires important state changes to be programmatically determinable without
  an unexpected focus change. The resulting action outcome is concise and uses
  the existing polite status treatment.
- [W3C WCAG 2.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  supports clear instructions that explain the expected operator action without
  overwhelming the screen with implementation detail.
- [WAI-ARIA Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  distinguishes normal status communication from an interrupting error alert.
  Empty-state cards are normal context; only a failed explicit refresh uses the
  existing alert path.
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
| New library | Persisted profile is specifically absent | What belongs here? | Sync library now | `Syncing library...`; a polite status explains that the profile is refreshing. | Run the existing authenticated library sync, generate a profile, then reread the workflow. |
| Sparse library | A current, valid profile has no usable observed suggestions | What belongs here? | Add declared intent | No busy state because this is guidance, not an action. | Show bounded guidance only. Classifarr does not invent purpose or render a control that cannot persist safely. |
| Unmapped library | The stored Arr mapping is absent or not route-ready | Can this route? | Open library mapping | `Opening library mapping...`; a polite status describes the navigation. | Open the existing library detail mapping workflow, then close the policy modal. No media is routed. |

A profile load failure, invalid evidence, or blocked evidence boundary is not a
new library. Those remain evidence-recovery outcomes so the operator is not
asked to synchronize a library when the product cannot safely establish that
claim.

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
- Reuses the existing write-protected sync and existing mapping screen.
- Keeps sparse evidence non-automatic and avoids non-functional buttons.

Cons:

- Adds a small response projection and focused client components.
- The sparse-library declared-intent control remains a later component task.

## Final Recommendation Stack

1. `server/src/services/policyOperatorWorkflowEmptyState.mjs` owns the
   state-to-question, state-to-action, busy-label, and busy-message mapping,
   plus an audit that rejects unknown, duplicate, misrouted, altered, or
   diagnostic-bearing states.
2. `server/src/services/policyOperatorWorkflowReadService.mjs` appends that
   read-only projection after it builds bounded observed-profile data.
3. `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
   renders the state in its owning question. It emits only validated action
   records and does not persist or route media.
4. `client/src/composables/usePolicyBuilderLibrarySync.js` performs the
   explicit `sync → profile refresh` sequence and returns a sanitized outcome.
5. `client/src/components/policies/PolicyBuilderModal.vue` tracks one active
   empty-state action ID, rereads the workflow after a successful sync, and
   closes only after navigation to the existing library mapping page succeeds.

## Outcome

New, sparse, and unmapped destinations now carry one visible, bounded next
action in the question that explains the condition. New-library recovery is
automatic only after the operator explicitly starts the existing library sync;
it then rebuilds the profile and rereads server-owned context. Sparse evidence
never becomes inferred identity, and unmapped destinations navigate to
configuration rather than attempting a route. While an action is active, only
that action receives its state-owned busy label. One workflow-level polite
progress message explains the active operation to every temporarily disabled
recovery action without mislabeling them.

## Next Step

Begin Phase 3R.3 by replacing the current workflow shell's generic context and
notice composition with the target `DestinationContextCard`,
`ObservedProfileSummary`, and `ReadinessNextActionCard` component vocabulary.
