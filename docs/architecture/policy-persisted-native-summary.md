# Persisted Native Policy Summary

## Decision

An established native policy now renders a compact read-only summary instead of
the five-question setup workflow used to create a destination. The summary
contains three bounded facts:

1. Display-safe declared purpose from the server-returned native policy
   contract.
2. Current **library** readiness from the existing server-owned workflow read.
3. The workflow read's one next-action label.

The summary deliberately does not call library-first readiness a policy-native
automation decision. The current endpoint derives its readiness from the
library's cached evidence and routing state, not from the persisted native
intent. It is therefore labelled *Current library readiness* until a dedicated
policy-native summary contract exists.

## Official Guidance Reviewed

Research reviewed in July 2026 against sources current through June 2026:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires server-side authorization for every request. The component presents
  server reads only and neither enables nor performs a policy mutation.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  says workflow state must be validated server-side and not sequenced by the
  front end. The displayed next action remains advisory; it is not an action
  authorization or client state transition.
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
  recommends safe output handling. The client normalizes bounded text and
  renders it through Vue interpolation, never `v-html`.
- [W3C WAI-ARIA `status` role](https://www.w3.org/TR/wai-aria-1.3/)
  defines a polite advisory live region that must not receive focus as a result
  of a status change. The compact summary uses one atomic, non-focus-moving
  status announcement.

## Options Considered

### Keep The Five-Section Setup Workflow For Persisted Native Policies

Pros: no new component is required.

Cons: asks an operator to revisit creation questions after the destination has
already been declared and buries the only relevant current status. Rejected.

### Recalculate Native Policy Readiness In The Browser

Pros: the summary could call its result policy-specific immediately.

Cons: duplicates server semantics, can become stale, and would make browser
state look authoritative. Rejected.

### Compact Summary With Stored Purpose And Existing Library Readiness

Pros: removes setup noise now, accurately labels the available server result,
retains one server-provided next action, and adds no mutation path. Selected.

Cons: readiness is library-specific rather than an active-native-intent
evaluation. A dedicated server contract remains necessary.

## Implementation

- `policyNativePolicySummary.js` creates bounded display lines from only the
  exact server-reported native contract and exposes a safe unavailable state
  without rendering a workflow error.
- `PolicyNativePolicySummary.vue` renders declared purpose, current library
  readiness, and one next action with semantic definition-list markup.
- `PolicyBuilderModal.vue` renders this summary for `native_view`; the generic
  workflow shell remains available for native creation and compatibility edit.
- The previous transient native-status component was deleted rather than kept
  beside its complete replacement.

## Security And Accessibility Outcome

- No client code authorizes policy writes, routing, or automation.
- Only canonical native-contract purpose is displayed; malformed or legacy
  contracts do not become a native summary.
- Raw workflow failures are replaced with a stable availability message.
- The next action is advisory display text from the server read, not an
  executable browser transition.
- Assistive technology receives one polite, atomic status without focus theft.

## Verification

- Unit tests cover canonical native purpose projection, legacy rejection,
  server-read readiness projection, and failure redaction.
- Modal coverage proves a persisted native policy shows compact purpose and
  readiness while omitting the five-question workflow, compatibility editor,
  advanced settings, footer, preset data, and settings reads.

## Final Recommendation Stack

1. Keep creation and established-native views separate.
2. Present stored native purpose only from the policy detail read contract.
3. Label the current server workflow result as library readiness until its
   inputs include active native intent.
4. Keep the displayed next action advisory and server-sourced.
5. Add a dedicated policy-native readiness read contract before displaying a
   policy-specific automation claim.

## Next Item

Implement the policy-specific server readiness summary contract. It must load
the active native intent, current stored profile evidence, and routing state;
evaluate them on the server; return bounded state and exactly one next action;
and remain read-only with no provider, quota, classification, routing, or
policy-write side effect.
