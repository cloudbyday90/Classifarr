# Policy Builder Phase 3R Evidence-Backed Option Selection

Status: implemented as the fourth Phase 3R operator-workflow contract.

## Scope

Phase 3R.4 defines how policy-builder option pickers distinguish generic
choices from observed library evidence before the Vue controls are rebuilt.

This checkpoint does not add another diagnostic panel. It gives future
multi-select controls a small deterministic contract for source labels,
read-only evidence, disabled states, explanations, and typed draft commands.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- WAI-ARIA Authoring Practices Guide, Listbox Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- Vue Test Utils Guide:
  https://test-utils.vuejs.org/
- Vitest Guide:
  https://vitest.dev/guide/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Multi-select controls need explicit selected, disabled, and grouped states.
- Disabled options need visible and programmatic reason text.
- Evidence should be source-labeled, normalized, bounded, and treated as input
  data rather than durable authority.
- Tests should assert behavior contracts and emitted commands instead of
  transitional layout.
- Server-side contracts should reject ambiguous option sources and prevent raw
  compatibility payload mutation from becoming the normal authoring path.

## Recommendation Stack

1. Treat every option as a typed candidate with:
   - value,
   - label,
   - source ID,
   - selection state,
   - optional evidence count,
   - optional confidence,
   - explanation,
   - disabled reason when unavailable.
2. Keep observed library values read-only until the operator accepts them
   through a typed draft command.
3. Keep selectable suggestions separate from read-only evidence:
   - observed library evidence,
   - suggested from observed profile,
   - suggested from starter template,
   - common static option,
   - operator-added custom value,
   - already declared,
   - unavailable because of conflicting intent.
4. Require explanations for suggested and custom selectable options.
5. Require disabled reasons for already-declared and conflicting choices.
6. Reject broad destination-identity genres from common/static or custom
   sources unless supporting evidence exists.
7. Emit typed draft commands for multi-select adds; never mutate raw bridge
   payloads from an option picker.

## Pros And Cons

### Read-Only Observed Evidence

Pros:

- Uses the media-server library as source-of-truth context without silently
  creating durable intent.
- Makes "already in this library" visibly different from "policy says this
  belongs here."
- Prevents broad genre counts from becoming rules without operator acceptance.

Cons:

- Requires one explicit operator action before observed values become declared
  intent.
- Future UI copy must be careful so read-only evidence is not mistaken for a
  disabled error.

### Source-Labeled Multi-Select Commands

Pros:

- Supports the operator task of adding several simple signals at once.
- Preserves provenance for later learning and rollback.
- Gives tests a stable command boundary.

Cons:

- Requires the picker to carry more structured metadata than a plain dropdown.
- Custom values need validation and explanation text before save.

### Broad Genre Guard

Pros:

- Prevents `Animation`, `Comedy`, `Drama`, and other broad labels from being
  presented as destination identity just because they are common options.
- Forces identity to come from observed evidence, explicit operator intent, or
  explained suggestions.

Cons:

- Some low-volume libraries may need custom labels or manual explanation before
  the first observed profile is strong.

## Final Recommendation

Build Phase 3R.4 around one deterministic option-selection contract:

```text
option candidate
  -> normalize source, state, evidence, explanation, disabled reason
  -> validate source and authority
  -> selectable candidates emit typed draft commands
  -> read-only evidence and disabled candidates stay visible but do not emit
```

The normal picker should show fewer controls, not more: grouped source sections,
multi-select adds, visible chips, and one explanation for why each suggestion is
present.

## Implementation

The Phase 3R.4 implementation now provides:

- `server/src/services/policyBuilderPhase3EvidenceBackedOptionSelection.mjs`
  - defines source behavior for observed evidence, observed-profile
    suggestions, starter-template suggestions, common options, custom values,
    already-declared values, and conflicting choices,
  - normalizes candidate value, label, source label, evidence count, confidence,
    explanation, and disabled reason,
  - validates source IDs, evidence requirements, explanation requirements,
    disabled reasons, broad identity genres, and auto-declaration attempts,
  - builds multi-select typed command plans for selectable options only,
  - rejects raw bridge mutation command boundaries.
- `server/src/__tests__/services/policyBuilderPhase3EvidenceBackedOptionSelection.test.mjs`
  - pins source behavior and selection states,
  - proves observed evidence remains read-only and cannot auto-declare,
  - checks suggested/custom explanation requirements,
  - checks disabled reason requirements,
  - checks broad genre guardrails,
  - verifies typed command-plan output.
- `server/src/services/policyBuilderPhase3ComponentSystem.mjs`
  - now includes `operator_added_custom` as a first-class option source.

## Phase 3R.4 Checklist Result

| Check | Result |
| --- | --- |
| Available option versus observed evidence separated | Yes; observed evidence is `read_only_evidence`, while suggestions/custom values are selectable. |
| Multi-select emits typed draft commands | Yes; command plans use `typed_draft_commands` and `add_signal_value`. |
| Suggested options explain why | Yes; observed-profile, starter-template, and custom selectable values require explanation. |
| Already configured values disabled or marked | Yes; already-declared values require a disabled reason and never emit commands. |
| Conflicting values unavailable with reason | Yes; conflicting choices require a disabled reason. |
| Broad genres protected from unsupported identity claims | Yes; common/custom broad identity genres require supporting evidence. |

## Next Step

Continue with **Phase 3R.5 Hard Limits And Avoid UX**. That task should apply
the same source, explanation, and typed-command discipline to blocking
constraints so hints and hard limits cannot be confused.
