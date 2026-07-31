# Policy Compatibility Maintenance Entry Audit

## Status

Implemented as the Phase 6R.5 compatibility-maintenance entry cutline.

## Outcome

Persisted policy presentation no longer treats `policy_intent_contract.source`
by itself as proof of a usable native policy. The client now consumes the
existing server policy-read projection as four bounded states:

| State | Server evidence required | Presentation | Writes |
| --- | --- | --- | --- |
| `native_create` | No positive persisted policy ID | Destination-first creation workflow | Native creation only |
| `legacy_edit` | Persisted policy with no native source in its contract or read trace | Compatibility maintenance | Existing compatibility path only |
| `native_view` | Native contract, successful contract validation, and `native_intent_active` trace | Read-only native summary | None |
| `native_recovery` | Any native indication that is invalid, conflicting, incomplete, or trace-mismatched | Read-only recovery notice | None |

An invalid native record therefore cannot open compatibility editing, and it
cannot be presented as a healthy native policy. The recovery notice deliberately
contains no repair, conversion, retry, routing, or provider control. Existing
server-owned reconciliation retains responsibility for repairing the record.

## Entry Inventory

`PolicyBuilderModal.vue` obtains the mode from
`buildPolicyBuilderExperienceMode`. The classifier delegates to the modular
`policyNativePolicyReadState` utility, which reads only the display-safe
contract and trace returned by the policy detail route.

### Native Create

A missing, zero, or non-integer policy ID means the browser is preparing a new
policy. This is the only state allowed to mount the operator-workflow read and
native creation controls.

### Compatibility Maintenance

A positive policy ID without a native source indication remains in
compatibility maintenance. This preserves the retained serializer for an
unconverted policy. It is not conversion evidence: the server locks and
rechecks active native intent before accepting any compatibility behavior write.

### Validated Native View

The browser selects the native summary only when all of these server-returned
facts agree:

1. `policy_intent_contract.source` is `native_intent`.
2. `policy_intent_contract.validation.valid` is `true`.
3. `policy_intent_read_trace.source` is `native_intent`.
4. `policy_intent_read_trace.status` is `native_intent_active`.

The client does not recreate these facts from library evidence, stored fields,
or a local draft.

### Native Recovery

Any native source indication that fails the validated-active proof enters
read-only recovery. This covers `native_intent_invalid`,
`native_intent_authority_conflict`, a missing trace, and a contract/trace
mismatch. The modal omits the compatibility editor, advanced settings, save
footer, native readiness request, and destination-first workflow.

## Minimum Server-Owned Exit Proof

No new browser migration state or conversion endpoint is required for this
cutline. A policy may leave compatibility maintenance only when the next server
detail read provides the existing validated-active proof above. That proof is
already derived by:

1. `policyNativePolicyReadService.mjs`, which reads active native intent rows
   and their validation record.
2. `policyIntentRuntimeReadPath.mjs`, which emits an explicit native or
   compatibility source and bounded read status.
3. `policyLegacyWriteGuard.mjs`, which locks the persisted policy and blocks
   legacy behavior writes when any active native intent exists, regardless of
   the browser presentation.

The client may display conservative recovery state, but it cannot promote a
policy to native, suppress the server write guard, or start reconciliation.

## Official Guidance Reviewed

Research was reviewed on 2026-07-30 against official guidance current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-stored workflow state, server-side re-derivation of
  security-relevant values, and rejection of invalid state transitions. The
  server read trace and write guard are the authority; the client state is
  display input only.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires authorization on every request and testing of authorization logic.
  The policy write guard rechecks the persisted record rather than trusting the
  browser-selected mode.
- [OWASP API Security: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
  recommends record-level permission checks for every endpoint accepting an
  object identifier. Existing policy mutation routes retain that server-side
  record check; this UI classification adds no write capability.
- [W3C ARIA22: Status Messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  recommends a polite status role for dynamic state updates. The recovery
  notice uses `role="status"` with explicit atomic announcement and does not
  move focus or provide a misleading action.

## Options Considered

| Option | Advantages | Costs |
| --- | --- | --- |
| Select native view from contract source alone | Smallest client condition | Invalid or conflicting native records appear healthy and can trigger an irrelevant readiness read. |
| Infer native state from browser draft or stored compatibility fields | Can avoid a server read | Makes browser data authoritative and can drift from the locked mutation state. |
| Keep compatibility editing for invalid native records | Familiar editor remains available | Risks legacy writes against a policy that has active native state; rejected. |
| Require the server's validated active trace and use read-only recovery otherwise | Fail-closed presentation, no new mutation capability, aligns with existing server guards | Adds a small recovery component and requires trace-aware client tests. |

## Security And Accessibility Outcome

- No client-controlled property can select a native write, conversion, or
  compatibility write path on the server.
- A malformed native projection fails closed into read-only recovery rather
  than a mutable compatibility surface.
- The native readiness endpoint is called only for the validated-native view.
- Recovery text is static and bounded; it exposes no raw validation errors,
  row identifiers, database details, provider status, or reconciliation data.
- The recovery state is announced politely without focus theft or an
  inaccessible action.

## Verification

- `client/src/__tests__/utils/policyNativePolicyReadState.test.js` covers valid,
  invalid, conflicting, incomplete, mismatched, and compatibility projections.
- `client/src/__tests__/utils/policyBuilderExperienceMode.test.js` verifies all
  four policy-builder modes.
- `client/src/__tests__/PolicyBuilderModal.test.js` verifies recovery has no
  editor, save footer, workflow, or native-readiness request.
- `server/src/__tests__/services/policyIntentMapper.test.mjs` verifies invalid
  native intent is emitted with the explicit non-active native trace.

## Final Recommendation Stack

1. Treat validated server projection plus active trace as the only native-view
   admission criterion.
2. Treat any invalid, conflicting, incomplete, or mismatched native indication
   as read-only recovery, never compatibility editing.
3. Keep the server read route and locked legacy write guard as the authority
   for policy state and mutation admission.
4. Do not add browser migration, retry, repair, or conversion controls to this
   state.
5. Use one bounded status announcement to explain protection without exposing
   internal diagnostics.

## Next Item

Phase 6R.5 compatibility editor scope, readiness boundary, section-advisory,
and configuration-summary cutlines are now implemented in [Policy
Compatibility Editor Scope Audit](policy-compatibility-editor-scope-audit.md),
[Policy Compatibility Intent Readiness Boundary
Audit](policy-compatibility-intent-readiness-boundary-audit.md), [Policy
Compatibility Section Advisory Scope
Audit](policy-compatibility-section-advisory-scope-audit.md), and [Policy
Compatibility Section Configuration Summary Scope
Audit](policy-compatibility-section-configuration-summary-scope-audit.md), and
[Policy Compatibility Group Instruction Scope
Audit](policy-compatibility-group-instruction-scope-audit.md), [Policy
Compatibility Editor Framing Copy Scope
Audit](policy-compatibility-editor-framing-copy-scope-audit.md), [Policy
Compatibility Maintenance Surface Framing
Audit](policy-compatibility-maintenance-surface-framing-audit.md), and [Policy
Compatibility Migration Notice
Audit](policy-compatibility-migration-notice-audit.md). The compatibility
routing-readiness card retirement audit is implemented in [Policy Compatibility
Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
The grid retirement is implemented in [Policy Compatibility Setup-Card Grid
Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
Next, perform the **Phase 6R.5 policy user-mental-model setup-card contract
audit** and remove unreachable server-side card data without disturbing active
workflow contracts.
