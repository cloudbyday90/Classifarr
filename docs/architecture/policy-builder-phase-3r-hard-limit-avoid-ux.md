# Policy Builder Phase 3R Hard Limits And Avoid UX

Status: implemented as the fifth Phase 3R operator-workflow contract.

## Scope

Phase 3R.5 defines how the re-imagined policy builder separates hard limits
from avoid signals and review warnings. This checkpoint keeps blockers explicit,
keeps absence-based observations as warnings, and prevents rating controls from
mixing max-rating and avoid-rating semantics.

This is a contract checkpoint, not a new scoring surface. The goal is to make
future UI controls simpler by reducing constraint behavior to a small set of
validated commands.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final
- Vue Test Utils Guide:
  https://test-utils.vuejs.org/
- Vitest Guide:
  https://vitest.dev/guide/

The applied guidance:

- Blocking controls need clear labels, descriptions, and confirmation behavior.
- Error and disabled states need visible and programmatic explanations.
- User-editable values should be allowlisted and normalized before they affect
  durable behavior.
- Server-side contracts should validate constraints independently from the
  browser UI.
- Tests should verify command behavior and invalid-state rejection, not just
  rendered copy.

## Recommendation Stack

1. Use three visible constraint concepts:
   - hard limit,
   - avoid,
   - review warning.
2. Treat hard limits as blocking constraints only after explicit operator
   action.
3. Treat avoid values as advisory by default; they lower confidence or trigger
   review, but do not become hard blocks unless a future explicit strict mode
   says so.
4. Treat observed absence as a review warning, never as an automatic hard limit
   or avoid rule.
5. Show examples of what a hard limit would block when conflict examples are
   available.
6. Keep certification semantics separate:
   - max allowed rating belongs to hard limits,
   - avoid rating belongs to avoid controls.
7. Emit typed draft commands only; do not mutate raw compatibility payloads from
   constraint controls.

## Pros And Cons

### Explicit Hard Limits

Pros:

- Operators can see which rules can block routing or classification.
- Existing media-server absence cannot silently create a blocker.
- Future runtime behavior can trust that blockers were declared intentionally.

Cons:

- The operator must confirm constraints that might look obvious from existing
  library contents.

### Advisory Avoid Values

Pros:

- Supports "prefer not here" without over-blocking legitimate edge cases.
- Preserves room for review warnings when evidence is incomplete.
- Keeps absence-based hints from becoming policy debt.

Cons:

- Operators may need a future strict toggle for destinations that intentionally
  reject specific values.

### Separate Rating Semantics

Pros:

- Prevents "max PG-13" and "avoid R" from being treated as the same behavior.
- Keeps future certification UI copy and server validation aligned.

Cons:

- Requires separate controls even when both use certification values.

## Final Recommendation

Build the Phase 3R constraint workflow around this sequence:

```text
review warning
  -> optional operator action
  -> avoid value or hard limit
  -> typed draft command
  -> server validation before save/runtime use
```

The normal UI should present hard limits as blockers, avoid values as advisory
signals, and absence-based observations as review warnings.

## Implementation

The Phase 3R.5 implementation now provides:

- `server/src/services/policyBuilderPhase3HardLimitAvoidUx.mjs`
  - defines hard-limit, avoid, and review-warning control records,
  - normalizes constraint candidates,
  - validates allowlisted sources, explicit operator action, typed command
    boundaries, absence-inference guardrails, block examples, and rating
    semantics,
  - builds typed command plans for valid hard-limit and avoid edits,
  - summarizes the checkpoint for roadmap and future UI work.
- `server/src/__tests__/services/policyBuilderPhase3HardLimitAvoidUx.test.mjs`
  - pins control vocabulary and component mapping,
  - proves hard limits and avoid controls require explicit operator action,
  - proves observed absence remains a review warning,
  - checks block-example requirements for conflict-backed hard-limit
    suggestions,
  - checks max-rating versus avoid-rating separation,
  - rejects raw bridge mutation command boundaries.

## Phase 3R.5 Checklist Result

| Check | Result |
| --- | --- |
| Hint versus blocker distinction | Yes; hard limits are blocking, avoid and review warning controls are advisory. |
| Hard limits require explicit intent | Yes; hard-limit candidates require explicit operator action. |
| Avoid controls do not silently learn from absence | Yes; absence-based avoid candidates are rejected and absence warnings remain review warnings. |
| Block examples supported | Yes; conflict-example hard-limit suggestions require an example when that source is used. |
| Rating semantics separated | Yes; hard limits use max allowed rating and avoid controls use avoid rating. |
| Typed command boundary enforced | Yes; raw bridge mutation command boundaries are rejected. |

## Next Step

Continue with **Phase 3R.6 Readiness And Next Action Surface**. That task
should replace dense diagnostics with action-oriented readiness states and links
to the resolving destination workflow section.
