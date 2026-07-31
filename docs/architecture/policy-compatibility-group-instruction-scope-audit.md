# Policy Compatibility Group Instruction Scope Audit

**Status:** Implemented  
**Phase:** 6R.5 Operator Workflow Rebuild  
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Retain one concise direct-editing instruction for each compatibility editor
group. Remove all helper text that predicts review readiness, automation
safety, matching fit, or confidence behavior from the browser-side draft.

Group titles, labeled controls, selected chips, and control-local instructions
already identify the related configuration. The retained helpers tell an
operator what can be edited without representing a local policy evaluation.
Native policy workflow readiness remains the only server-owned behavior and
readiness projection.

This change adds no endpoint, policy write, validation rule, or runtime
decision logic.

## Scope Classification

| Group | Previous helper | Classification | Retained helper |
| --- | --- | --- | --- |
| Ask When Unsure | `Review readiness ... not safe enough to automate.` | Browser-owned readiness and automation interpretation | `Choose the conditions that need review.` |
| Belongs Here | `Accept destination identity from observed examples or explicit operator intent.` | Over-broad acceptance framing | `Add signals that identify this destination.` |
| Destination Rules | `Set helpful matches, hard limits, and avoid values as explicit destination rules.` | Direct editing guidance | `Add helpful matches, hard limits, or avoid values.` |
| Boosts | `Use boosts only after the item already fits this destination.` | Browser-owned fit and confidence interpretation | `Add optional supporting signals.` |

## Research And Recommendation

[OWASP's Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
states that client state is input rather than truth and that workflow invariants
must be enforced server-side. A static compatibility helper must not imply that
the browser establishes automation safety, review state, fit, or confidence.

[W3C's Grouping Controls guidance](https://www.w3.org/WAI/tutorials/forms/grouping/)
recommends grouping related controls with concise group labels so people can
understand smaller, manageable sets of inputs. [W3C's Labels or Instructions
guidance](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
requires visible instructions when user input is needed. Short direct-editing
helpers satisfy those needs without duplicating policy-runtime semantics.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Retain existing group helpers | Familiar explanatory prose | Implies browser-owned readiness, fit, and confidence behavior. |
| Remove all group helpers | Lowest visual density | Weakens context for grouped controls and discards useful editing direction. |
| Retain concise direct-editing helpers | Preserves accessible group context without runtime claims | Less explanatory prose; detailed behavior remains correctly server-owned. |

## Final Recommendation Stack

1. Keep one short instruction that names the editable signals in each group.
2. Keep group titles, selected chips, and control-local help as the complete
   browser-side context for an unsaved compatibility draft.
3. Keep availability, duplicate prevention, typed commands, validation,
   readiness, and runtime semantics in their existing bounded owners.
4. Do not recreate static language that claims whether automation is safe,
   when Classifarr will ask, or how signals affect fit or confidence.

## Implementation Outcome

- Replaced all four `policyIntentEditorGroups.js` helpers with direct-editing
  language.
- Added focused assertions that pin the group titles, targets, section
  membership, and scoped helpers.
- Preserved group IDs, target IDs, section membership, rendering structure,
  accessibility labels, and typed draft-command behavior.

## Verification

- Focused group and compatibility editor tests verify static group projection
  and rendering behavior.
- Full client tests, build, static checks, coverage ratchet, affected server
  inventory checks, and documentation lint remain release gates.

## Next Item

Perform a **compatibility editor framing-copy scope audit** for
`client/src/components/policies/PolicyIntentEditor.vue`. Classify its static
header, context count, and empty-state copy as direct editing context or
browser-owned workflow interpretation. Do not add a compatibility API, broaden
writes, or recreate readiness.
