# Policy Compatibility Maintenance Surface Framing Audit

**Status:** Implemented
**Phase:** 6R.5 Operator Workflow Rebuild
**Research baseline:** June 2026 best practices, reviewed 2026-07-31

## Decision

Reduce `PolicyCompatibilityMaintenanceSurface.vue` framing to direct
maintenance context: the policy is existing, and the operator can update its
destination signals. Retain the visible heading, the section-to-heading
relationship, and the nested destination-intent editor label. Remove the
browser-owned promise that the surface preserves decision behavior and the
static status announcement that compares this surface with new-policy setup.

The compatibility maintenance surface is a presentation and typed-command
boundary. It must not state that it governs save behavior, policy
establishment, readiness, or runtime decision behavior. Server validation and
existing write handling remain the authority for those concerns.

This change adds no endpoint, policy write, validation rule, or runtime
decision logic.

## Scope Classification

| Frame element | Previous copy | Classification | Decision |
| --- | --- | --- | --- |
| Eyebrow | `Existing policy` | Direct persisted-policy context | Retain. |
| Heading | `Compatibility policy maintenance` | Internal compatibility terminology | Replace with `Maintain destination intent`. |
| Description | `... preserves its decision behavior.` | Browser-owned runtime behavior claim | Replace with direct edit task. |
| Static status | `New policies use destination-first setup...` | Workflow comparison and non-changing live-region content | Remove. |
| Nested region name | `Compatibility policy intent editor` | Legacy-focused accessible name | Rename `Destination intent editor`. |

## Research And Recommendation

[W3C's Understanding SC 3.3.2](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
states that instructions should help users provide the necessary input without
cluttering the page. [W3C's Labeling Controls guidance](https://www.w3.org/WAI/tutorials/forms/labels/)
also calls for clear labels that identify the purpose of controls. The retained
heading, direct description, and nested editor name identify the work without
explaining unowned behavior.

[WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria/) defines `status` as a live
region with polite, atomic announcements. A permanent explanatory paragraph is
not a changed advisory result, so it must remain ordinary content if needed;
this comparison is not needed and is removed.

[OWASP's Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
states that client state is input rather than truth and that workflow
invariants must be enforced server-side. The browser therefore cannot assure
operators that it preserves decision behavior or establish workflow authority
through static copy.

### Options

| Option | Pros | Cons |
| --- | --- | --- |
| Retain full historic frame | Explains the legacy-versus-native distinction | Adds browser-owned workflow claims and a permanent live announcement. |
| Remove all framing | Minimal visual density | Removes the direct maintenance task and weakens accessible orientation. |
| Retain direct maintenance facts only | Names the current task, preserves clear section labeling, and avoids unsupported behavior claims | Historic workflow distinctions remain available only where server-provided and action-relevant. |

## Final Recommendation Stack

1. Use a short visible heading that names the current maintenance task.
2. Keep only factual, direct context for the existing policy and destination
   signal editing.
3. Reserve `role="status"` for changed advisory content, not permanent
   explanatory copy.
4. Keep accessible names concise, visible-context-aligned, and task-specific.
5. Keep policy validity, persistence, decision behavior, and workflow
   enforcement server-owned.

## Implementation Outcome

- Renamed the surface heading to `Maintain destination intent`.
- Replaced the runtime behavior claim with a direct destination-signal editing
  description.
- Removed the static `role="status"` workflow-comparison paragraph.
- Renamed the nested editor region to `Destination intent editor`.
- Preserved migration acknowledgement, intent summary, typed draft-command
  forwarding, API behavior, validation, persistence, and server-owned policy
  authority.

## Verification

- Focused maintenance-surface and modal tests verify direct framing, the
  absence of retired workflow copy, and retained typed event forwarding.
- Full client tests, build, static checks, coverage ratchet, affected server
  inventory checks, and documentation lint remain release gates.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
The grid retirement is implemented in [Policy Compatibility Setup-Card Grid
Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
Next, perform the **Phase 6R.5 policy user-mental-model setup-card contract
audit** and remove unreachable server-side card data without disturbing active
workflow contracts.
