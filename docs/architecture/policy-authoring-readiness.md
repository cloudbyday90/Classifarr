# Policy Authoring Readiness

Status: implemented as a durable policy-authoring contract.

## Scope

Policy authoring readiness is the small, operator-facing projection that answers
one question: "What do I do next?"

This contract defines visible readiness states, issue-to-action mapping, and
destination workflow links. Retired preview, provider, metadata, scoring, and
parity diagnostics are rejected rather than modeled as an alternate readiness
surface.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WCAG Status Messages understanding document:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Status messages should be short, programmatically identifiable, and tied to
  the control or section that resolves them.
- Operator-facing status should avoid exposing raw provider, replay, scoring,
  parity, or metadata payload details.
- Server-side projections should allowlist visible states and issue IDs rather
  than passing arbitrary diagnostic keys to the browser.
- Tests should verify issue-to-action behavior and diagnostic exclusion instead
  of preserving old panel layout.

## Recommendation Stack

1. Use six visible readiness states:
   - `Ready`,
   - `Needs examples`,
   - `Needs review`,
   - `Needs routing`,
   - `Blocked by hard limit`,
   - `Stale profile`.
2. Give every readiness issue exactly one next action.
3. Link every next action to one destination workflow step and resolving
   component or setting.
4. Select the highest-priority issue when multiple issues exist, but preserve
   the full issue list for secondary display.
5. Reject all diagnostic identifiers from readiness, including identifiers from
   retired preview, provider, metadata, scoring, and parity panels.

## Pros And Cons

### Action-Oriented Readiness

Pros:

- Replaces diagnostic interpretation with a concrete next action.
- Keeps the normal workflow understandable without provider, scoring, replay, or
  parity knowledge.
- Gives future UI work stable state IDs and links.

Cons:

- Advanced operators lose immediate access to some diagnostic detail in the
  normal authoring path.

### Diagnostic Retirement

Pros:

- Removes a second authoring mental model and its stale access-control surface.
- Rejects retired diagnostic identifiers deterministically instead of allowing
  an undocumented alternate path.
- Keeps provider and scoring internals out of author-facing readiness results.

Cons:

- Historical diagnostics must be investigated through bounded evidence,
  readiness, and rollback contracts rather than a policy-builder panel.

## Final Recommendation

Build the normal readiness surface as a small projection:

```text
readiness issue
  -> visible state
  -> one next action
  -> one resolving destination step/component
```

Everything else, including retired replay, provider, metadata, scoring, parity,
and impact details, is invalid authoring input.

## Implementation

The implementation provides:

- `server/src/services/policyAuthoringReadiness.mjs`
  - defines the six visible readiness states,
  - defines six readiness issues mapped to one next action each,
  - links issues to destination flow steps and resolving components,
  - builds a prioritized readiness projection,
  - rejects diagnostic identifiers from normal readiness.
- `server/src/__tests__/services/policyAuthoringReadiness.test.mjs`
  - pins visible readiness states,
  - proves each issue has exactly one next action and one destination link,
  - checks highest-priority issue selection,
  - checks ready-state save action,
  - rejects retired diagnostic identifiers from normal readiness.

## Checklist Result

| Check | Result |
| --- | --- |
| Visible readiness states defined | Yes; six state IDs are pinned. |
| One next action per readiness issue | Yes; every issue maps to one action. |
| Links to resolving section or setting | Yes; each issue links to a destination flow step and component. |
| Raw diagnostics removed from normal workflow | Yes; replay, provider, metadata, scoring, parity, and impact identifiers are rejected. |
| Readiness answers what to do next | Yes; projection returns the highest-priority next action. |
| Diagnostic panel tests redirected | Yes; server tests now protect readiness semantics and diagnostic rejection. |

## Next Step

Cut over the starter-template role reset contract to durable policy-authoring
names so templates remain optional accelerators after destination context.
