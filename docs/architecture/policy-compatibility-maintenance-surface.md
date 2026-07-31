# Policy Compatibility Maintenance Surface

## Status

Implemented for persisted policies that do not have a server-reported native
intent contract.

## Outcome

The policy modal now has three explicit presentation modes:

| Mode | Purpose | Surface | Workflow read |
| --- | --- | --- | --- |
| `native_create` | Establish a new destination | `PolicyBuilderWorkflowShell.vue` | Required |
| `native_view` | Inspect an established native policy | `PolicyNativePolicySummary.vue` | Not requested |
| `legacy_edit` | Maintain an existing compatibility policy | `PolicyCompatibilityMaintenanceSurface.vue` | Not requested |

The compatibility surface preserves the existing intent editor, migration
notice, footer commands, and serializer. It no longer appears below the
five-question native creation workflow, and it does not request the native
operator-workflow projection. This prevents native destination setup from being
presented as an incomplete task for an already-persisted compatibility policy.

The subsequent [Policy Compatibility Editor Scope
Audit](policy-compatibility-editor-scope-audit.md) removes raw browser-side
scoring, combination-mode, and threshold controls. Existing compatibility
decision values remain preserved by the serializer and validated by the server.

The subsequent [Policy Compatibility Maintenance Entry
Audit](policy-compatibility-maintenance-entry-audit.md) makes native inspection
conditional on a validated active server read. Invalid or conflicting native
records are read-only recovery, not compatibility maintenance.

## Problem

One modal previously presented the native destination workflow and the retained
compatibility editor in the same path. That made a persisted policy look as if
an operator needed to repeat destination establishment before performing a
bounded maintenance edit. It also fetched a server projection that the
compatibility path could neither save nor use as authority.

The shared presentation obscured the product cutline:

- observed library evidence is input to new native establishment, not a rule
  that the browser can infer for an existing policy;
- retained compatibility writes continue through their existing serializer and
  server validation; and
- the native workflow remains creation-only until a separate server-owned
  migration path establishes native authority.

## Official Guidance Reviewed

Research was reviewed on 2026-07-30 against official guidance current through
June 2026:

- [W3C WAI-ARIA Authoring Practices: Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires a modal dialog to retain focus within the dialog, expose a visible
  close control, and restore focus when it closes. The maintained shared modal
  already provides that boundary; this work changes the content mode rather
  than introducing a nested dialog.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing workflow state and business rules on the server rather
  than assuming a browser sequence is authoritative. The client uses the
  server-returned policy contract only to select presentation; it does not
  establish native intent or authorize a write.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends validating input at the trust boundary. Compatibility events keep
  their existing typed client boundary and server validation instead of being
  transformed through the native workflow shape.

## Options Considered

| Option | Advantages | Costs |
| --- | --- | --- |
| Keep the native workflow and compatibility editor in one modal flow | No new component | Conflates creation with maintenance, fetches an unused workflow projection, and makes the legacy path look like an unfinished native setup. |
| Hide compatibility editing | Reduces visible controls | Breaks required persisted-policy maintenance before a server-owned conversion exists. |
| Dedicated compatibility maintenance surface | Separates user goals, preserves existing write behavior, and removes unnecessary native workflow reads | Adds one small presentation component until the compatibility path is removed. |

## Design

`PolicyBuilderModal.vue` owns mode selection through
`buildPolicyBuilderExperienceMode`:

1. Native creation alone mounts `PolicyBuilderWorkflowShell` and watches the
   operator-workflow read for the selected library.
2. A persisted native policy alone mounts its read-only summary and policy
   readiness read.
3. A persisted compatibility policy alone mounts
   `PolicyCompatibilityMaintenanceSurface`.

The compatibility surface is a thin event-forwarding composition boundary. It
accepts the existing preset, intent-draft, reference-data, and summary props.
It forwards typed draft commands without changing their payloads. Save,
authorization, serialization, and routing readiness remain in their existing
modules.

Library-profile refresh remains available only for compatibility maintenance,
where it existed before. A successful refresh does not reload the native
workflow for that policy. It therefore cannot manufacture native intent or
turn observed evidence into a policy declaration.

## Security And Accessibility Outcome

- The client never uses the maintenance heading, mode, or local draft to assert
  native policy authority.
- A compatibility policy does not call the native operator-workflow endpoint;
  that endpoint remains a new-policy presentation input.
- Existing server authorization and payload validation remain the write
  authority. No route, service, database contract, or payload was broadened.
- The existing modal focus lifecycle remains the sole dialog boundary; the
  maintenance surface adds no nested modal behavior.
- Raw scoring controls are absent; the retained operator controls are only
  labeled destination-rule maintenance actions.

## Verification

- `client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js`
  verifies landmarks, labels, retained event forwarding, and migration-notice
  acknowledgement.
- `client/src/__tests__/PolicyBuilderModal.test.js` verifies that a
  compatibility policy renders the maintenance surface and does not request or
  render the native workflow or retired diagnostic panels.
- `client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js` verifies
  raw advanced controls are absent while retained typed commands remain.

## Final Recommendation Stack

1. Keep native creation, established-native inspection, and compatibility
   maintenance as separate presentation modes.
2. Request the native operator-workflow projection only for native creation.
3. Retain compatibility editing only behind its dedicated maintenance surface
   until a server-owned migration and deletion gate permits removal.
4. Keep policy authority, mutation validation, and migration decisions on the
   server.
5. Keep raw scoring and threshold configuration outside the operator surface
   while server validation preserves compatibility safety.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
The grid retirement is implemented in [Policy Compatibility Setup-Card Grid
Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
Next, perform the **Phase 6R.5 policy user-mental-model setup-card contract
audit** and remove unreachable server-side card data without disturbing active
workflow contracts.
