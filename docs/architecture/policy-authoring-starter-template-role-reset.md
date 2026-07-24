# Policy Authoring Starter Template Role Reset

Status: implemented.

## Decision

Starter templates are optional accelerators for existing compatibility-policy
editing, not a second policy language. A template can be selected after the
library and destination context are known. It cannot require a save or expose
the raw compatibility representation that supports older policies.

## Research

Official guidance reviewed in July 2026:

- [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  supports a button-controlled optional region with exposed expanded state.
- [WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  requires clear purpose and instructions for controls.
- [WCAG 2.2 Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification)
  supports stable, purpose-based control names.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports keeping untrusted values bounded and validating state at the
  authoritative boundary.

## Alternatives

| Approach | Benefits | Costs |
| --- | --- | --- |
| Keep raw template editor | Maximum legacy flexibility | Makes bridge fields look like policy authority and increases decision load. |
| Hide raw editor but retain active components | Smaller initial diff | Leaves dead code and stale ownership paths. |
| Bounded optional selector | Keeps useful seed choice while preserving one policy model | Advanced legacy changes wait for native storage migration. |

## Final Stack

1. Keep `PolicyStarterTemplateAccelerator.vue` as an optional disclosure.
2. Keep `PolicyStarterTemplateBrowser.vue` as accessible bounded selection
   controls with clear use/remove labels.
3. Delete raw template-detail, selected-template, combined-signal, and
   template-signal presentation surfaces.
4. Keep compatibility serialization behind `policyIntentDraftBridge.js` and
   server request validation only.
5. Keep native creation on server-owned typed `add_signal` suggestions.

## Implemented Outcome

- Deleted raw customization, weighting, removal, strictness, warning, score,
  and usage interfaces.
- Deleted the orphaned template-signal and combined-signal presentation
  composables with their tests.
- Updated workflow, boundary, compatibility, deletion-gate, and presentation
  inventories so they describe only active surfaces.
- Retained no client authority for policy persistence, routing, learning,
  provider calls, quota use, or media-server writes.

## Verification

Focused client and server boundary suites cover disclosure, selection events,
the absence of raw mechanics, accessibility labels, compatibility ownership,
and the legacy bridge raw-write boundary.
