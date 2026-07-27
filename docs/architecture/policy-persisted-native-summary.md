# Persisted Native Policy Summary

## Decision

An established native policy now renders a compact read-only summary instead of
the five-question setup workflow used to create a destination. The summary
contains three bounded facts:

1. Display-safe declared purpose from the server-returned native policy
   contract.
2. Current **policy** readiness from a server-owned active-native-intent,
   cached-profile, and routing read.
3. The policy-specific read's one next-action label.

The summary deliberately separates declared policy authority from observed
library context. Native intent establishes destination identity; cached profile
state contributes freshness only. The summary is labelled *Current policy
readiness* because its server contract evaluates both sources and routing.

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

### Compact Summary With Stored Purpose And Policy-Specific Readiness

Pros: removes setup noise, evaluates persisted native authority rather than a
creation draft, retains one server-provided next action, and adds no mutation
path. Selected.

Cons: adds a dedicated read endpoint and leaves every executable next action
to its own server command boundary.

## Implementation

- `policyNativeReadinessSummaryService.mjs` evaluates active native intent,
  cached profile freshness, and stored routing as a read-only server contract.
- `policyNativePolicySummary.js` creates bounded display lines and safe
  readiness/unavailable states without rendering a raw service error.
- `PolicyNativePolicySummary.vue` renders declared purpose, current policy
  readiness, and one next action with semantic definition-list markup.
- `PolicyBuilderModal.vue` renders this summary for `native_view` and does not
  request the generic operator workflow; native creation and compatibility edit
  retain their appropriate workflow surfaces.

## Security And Accessibility Outcome

- No client code authorizes policy writes, routing, or automation.
- Only canonical native-contract purpose is displayed; malformed or legacy
  contracts do not become native authority.
- The policy-specific read validates native authority and cannot fall back to a
  library-derived draft when authority is unavailable.
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
3. Evaluate cached profile freshness and stored routing only on the server.
4. Keep the displayed next action advisory and server-sourced.
5. Fail closed when native authority or the read contract is unavailable.

## Next Item

Implement automatic, server-owned profile refresh handling for the existing
`refresh_profile` readiness action. It must be scheduler/outbox driven,
deduplicated, lease-protected, retry-bounded, and independent of browser
interaction or policy writes.
