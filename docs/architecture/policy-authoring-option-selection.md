# Policy Authoring Option Selection

Status: implemented as the policy-authoring option-selection contract.

## Scope

This document defines how policy-authoring controls classify and validate
option candidates before they become draft intent. The contract separates
observed library evidence, selectable suggestions, custom operator values,
already-declared values, and conflicting choices without using roadmap-phase
names in production code.

This is not a diagnostic panel. It is the deterministic option contract that
future picker, multi-select, and chip controls must honor.

## Official Guidance Reviewed

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG Labels or Instructions: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- WAI-ARIA Authoring Practices Guide Combobox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- WAI-ARIA Authoring Practices Guide Patterns: https://www.w3.org/WAI/ARIA/apg/patterns/
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

Applied guidance:

- Selectable controls need clear labels, source context, and selected/disabled
  state.
- Disabled or unavailable choices need visible and programmatic reasons.
- Server-side option contracts should accept only known source IDs, known state
  IDs, bounded numeric evidence, and typed command boundaries.
- Observed evidence should remain context until an operator explicitly accepts
  it into draft intent.

## Recommendations

1. Treat every option as a typed candidate with value, label, source ID,
   selection state, source label, optional evidence count, optional confidence,
   explanation, and disabled reason.
2. Keep observed library values read-only until the operator accepts them
   through a typed draft command.
3. Keep selectable suggestions separate from read-only evidence:
   observed library evidence, suggested from observed profile, suggested from
   starter template, common static option, operator custom value, already
   declared value, and unavailable conflicting value.
4. Require explanations for suggested and custom selectable options.
5. Require disabled reasons for already-declared and conflicting choices.
6. Reject broad destination-identity genres from starter-template, common/static,
   or custom sources unless supporting evidence exists.
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
- UI copy must make read-only evidence feel useful rather than broken.

### Source-Labeled Multi-Select Commands

Pros:

- Supports adding several simple signals at once.
- Preserves provenance for learning, rollback, and native storage migration.
- Gives tests a stable command boundary.

Cons:

- Requires more structured metadata than a plain dropdown.
- Custom values need validation and explanation text before save.

### Broad Genre Guard

Pros:

- Prevents `Animation`, `Comedy`, `Drama`, and other broad labels from being
  presented as destination identity just because they are common options.
- Forces identity to come from observed evidence, explicit operator intent, or
  explained suggestions.

Cons:

- Some low-volume libraries may need custom labels or manual explanation before
  the observed profile is strong.

## Final Recommendation Stack

- `server/src/services/policyAuthoringOptionSelection.mjs`
  - `POLICY_AUTHORING_OPTION_SELECTION_*` constants define source states,
    command IDs, and risk IDs.
  - `POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS` defines the evidence fields
    option controls may surface.
  - `policyAuthoringOption*` helpers normalize, validate, summarize, and build
    typed multi-select command plans.
- `server/src/__tests__/services/policyAuthoringOptionSelection.test.mjs`
  - Pins source behavior, selection states, read-only evidence behavior,
    explanation requirements, disabled reasons, broad genre guardrails, command
    boundaries, and summary output.
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
  - Tracks this contract as `policy_authoring_option_selection`.
- [Policy Intent-Signal Option Projection](policy-intent-signal-option-projection.md)
  - Defines the versioned server display projection that composes these source
    states without delegating source behavior to the browser.

## Outcome

The option-selection contract now uses durable policy-authoring names in the
service file, focused test, exported constants, exported helpers, completion
audit record, standing architecture document, and the server-owned option
projection.

## Next Step

Add the server-validated custom intent-signal entry command. It must feed its
normalized candidate back through the projection before the browser can create a
typed draft command.
