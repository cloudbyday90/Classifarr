# Policy Authoring Starter Templates

Status: implemented as a durable policy-authoring contract.

## Scope

Policy authoring starter templates are optional accelerators. They can suggest
intent after destination context is visible, but they cannot be required to
build a policy and cannot expose raw template mechanics in the normal authoring
path.

This contract does not remove compatibility bridge behavior yet. It defines
which template concepts remain product-facing, which mechanics are bridge-only,
and how applying a template becomes typed draft commands.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- WAI-ARIA Disclosure Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Optional helpers should not block completion of the primary workflow.
- Progressive disclosure should keep advanced mechanics behind the main
  destination-first task.
- User-facing controls should use bounded vocabulary and visible provenance.
- Server-side contracts should validate suggestion buckets and command payloads
  before durable behavior changes.
- Compatibility payload internals should not be exposed as normal product UI.

## Recommendation Stack

1. Present starter templates only after destination context is visible.
2. Do not require a template to build, save, or validate a policy.
3. Show template additions in product vocabulary:
   - Belongs Here,
   - Helpful Matches,
   - Hard Limits,
   - Avoid.
4. Keep template provenance visible but secondary to observed library evidence
   and operator-declared intent.
5. Apply template suggestions through existing typed draft commands.
6. Keep template mechanics, weights, raw `customSignals`, removed markers, and
   strict/advisory metadata out of normal authoring.
7. Mark raw template mechanics for bridge-only handling or native-storage
   deletion after native intent storage is authoritative.

## Pros And Cons

### Templates As Optional Accelerators

Pros:

- Users can build a policy directly from destination meaning.
- Templates remain useful for quick starts without controlling the mental model.
- New libraries can still use templates to fill initial gaps.

Cons:

- Existing template-first screens need later UI rework.

### Typed Template Application

Pros:

- Preserves the draft command boundary.
- Prevents raw compatibility payload mutation from template controls.
- Gives rollback and native-storage migration a clearer audit path.

Cons:

- Template application must translate suggestions into product vocabulary before
  emitting commands.

### Bridge-Only Mechanics

Pros:

- Keeps weights, removed markers, and raw custom signal details out of normal
  authoring.
- Makes native-storage deletion targets explicit.

Cons:

- Compatibility bridge mechanics remain temporary implementation support until
  native storage replacement is complete; they are not authoring surfaces.

## Final Recommendation

Build starter templates as a post-destination accelerator:

```text
destination context visible
  -> optional template suggestion
  -> product bucketed additions
  -> typed draft commands
  -> secondary provenance only
```

The normal policy builder should remain usable with no selected template.

## Implementation

The implementation provides:

- `server/src/services/policyAuthoringStarterTemplates.mjs`
  - defines template roles for optional accelerator, secondary provenance,
    bridge-only mechanic, and delete-after-native-storage,
  - maps starter-template suggestions to product vocabulary buckets,
  - validates destination-context-first placement,
  - rejects template-required save behavior and primary provenance,
  - builds existing `add_signal` draft commands from suggestions,
  - classifies template browser/details as accelerator surfaces,
  - classifies template mechanics, weights, raw custom signals, removed markers,
    and strict/advisory metadata as bridge-only or native-storage deletion
    targets.
- `server/src/__tests__/services/policyAuthoringStarterTemplates.test.mjs`
  - pins template role records,
  - verifies product bucket mapping,
  - proves templates cannot appear before destination context or be required to
    save,
  - proves template application emits valid typed draft commands,
  - keeps raw template mechanics out of normal authoring.

## Checklist Result

| Check | Result |
| --- | --- |
| Users can build without a template | Yes; templates are never required to save. |
| Templates appear after destination context | Yes; placement validation fails before destination context is visible. |
| Template additions use product vocabulary | Yes; suggestions map to Belongs Here, Helpful Matches, Hard Limits, and Avoid. |
| Template application uses typed commands | Yes; suggestions emit `add_signal` commands. |
| Provenance remains secondary | Yes; primary template provenance is rejected. |
| Template internals leave normal UI | Yes; raw mechanics, weights, custom signals, removed markers, and strict/advisory metadata are bridge-only or delete-after-native-storage. |

## 3R.7 Role-Reset Outcome

The legacy-edit template accelerator is now a bounded selection surface only.
It may show an optional, accessible template choice after destination context,
but it no longer renders template-detail editors, combined-signal summaries,
raw `customSignals`, weight controls, strictness or removal controls, runtime
warnings, suggestion scores, or policy-usage counts. The deleted components
and their unused presentation helper are not retained in the active
compatibility inventory.

Native authoring continues to accept server-owned `add_signal` suggestions.
Existing compatibility policies preserve their legacy payload only through the
draft bridge; the operator does not edit that representation directly.

## Next Step

Cut over the accessibility and decision-load contract to durable
policy-authoring naming.
