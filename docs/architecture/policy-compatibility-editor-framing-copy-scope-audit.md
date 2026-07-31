# Policy Compatibility Editor Framing Copy Scope Audit

**Status:** Implemented  
**Phase:** 6R.5 Operator Workflow Rebuild  
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Reduce `PolicyIntentEditor.vue` framing to direct editing context. Retain a
plain task heading, an explicit policy-context selector, and a factual empty
state. Remove implementation mechanics, browser workflow interpretation, and
redundant context counts.

The compatibility editor is a presentation and typed-command surface. It must
not imply that it preserves save semantics, reconciles library behavior, or
establishes new policy intent. Native policy workflow readiness remains the
only server-owned behavior and readiness projection.

This change adds no endpoint, policy write, validation rule, or runtime
decision logic.

## Scope Classification

| Frame element | Previous copy | Classification | Decision |
| --- | --- | --- | --- |
| Heading | `Policy Intent Builder` | Implementation-oriented surface name | Replace with `Edit destination intent`. |
| Save paragraph | `... without changing how existing policies save.` | Compatibility persistence mechanics | Remove. |
| Reconciliation paragraph | `Classifarr reconciles both.` | Browser-owned workflow interpretation | Remove. |
| Context count | `n existing policy contexts` | Redundant aggregate; the selector identifies each context | Remove. |
| Context selector | `Edit existing policy context` | Direct selection control with legacy framing | Rename `Choose policy context`. |
| Empty state | `New policy intent is established ...` | Browser-owned new-policy workflow claim | Replace with `No editable destination signals are available for this policy.` |

## Research And Recommendation

[W3C's Understanding SC 3.3.2](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
explains that labels and instructions should identify the input users need to
provide without cluttering the page with unnecessary information. [W3C's
Grouping Controls guidance](https://www.w3.org/WAI/tutorials/forms/grouping/)
also recommends concise labels so related controls remain manageable.

[OWASP's Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
states that client state is input rather than truth and that workflow
invariants must be enforced server-side. Browser framing must not suggest it
controls save behavior, reconciliation, establishment, or readiness.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Retain the full frame | Explains historic compatibility context | Adds implementation detail and implies browser-owned workflow behavior. |
| Remove all framing | Minimum visual density | Removes the direct task name and factual no-editable-signal status. |
| Retain direct editing facts only | Clear task and selectable context without runtime claims | Requires detailed behavior to remain in control-local help and server projections. |

## Final Recommendation Stack

1. Use a short heading that states the immediate edit task.
2. Keep the selector label and empty state factual, specific, and local to the
   displayed controls.
3. Keep configuration details in labeled groups, section cards, and selected
   chips rather than duplicate introductory prose.
4. Keep saving, reconciliation, policy establishment, readiness, and runtime
   semantics on the server.
5. Do not recreate compatibility browser framing that explains workflows the
   editor neither evaluates nor enforces.

## Implementation Outcome

- Renamed the compatibility editor heading to `Edit destination intent`.
- Removed two explanatory paragraphs and the redundant policy-context count.
- Renamed the selector to `Choose policy context`.
- Replaced the empty-state workflow explanation and accessible name with a
  factual unavailable-state message.
- Preserved section groups, labels, selected chips, focus target, typed draft
  commands, API behavior, validation, and save behavior.

## Verification

- Focused editor and modal tests verify direct framing, the accessible empty
  state, and absence of retired workflow copy.
- Full client tests, build, static checks, coverage ratchet, affected server
  inventory checks, and documentation lint remain release gates.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
Next, perform a **compatibility setup-card grid retirement audit** for
`PolicyBuilderSetupCards.vue` and `policyBuilderSetupCards.js`. Confirm the
grid remains unmounted, then remove it rather than preserve stale anchors or
browser-derived readiness state.
