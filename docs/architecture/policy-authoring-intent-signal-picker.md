# Policy Authoring Intent Signal Picker

Status: implemented as the first evidence-backed option-selection control for
native policy creation.

## Scope

The picker answers one question: which observed, identity-capable signals should
become declared destination purpose? It does not determine policy meaning from
its own data, write policy storage, route media, learn from decisions, or call a
provider. The connected media-server library remains the source of observed
context; the server supplies the normalized option contract; an operator must
explicitly add a suggestion before it enters the local draft.

## Official Guidance Reviewed

- [WAI-ARIA Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  requires a clearly labelled checkbox group and documents keyboard interaction
  for independently selectable values.
- [W3C Forms Tutorial: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends a `fieldset` and `legend` to convey the relationship among related
  inputs.
- [WCAG 2.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
  requires usable labels and instructions when interaction needs input.
- [WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports exposing selection changes without unexpectedly moving focus.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlist validation at the server boundary; browser state is not
  a security authority.

## Design

### Server-Owned Option Contract

`policyObservedSuggestionCandidates.mjs` now preserves normalized option fields
from `policyAuthoringOptionSelection.mjs` on both observations and selectable
suggestions. The workflow read therefore carries source labels, selection state,
selectability, read-only status, typed command ID, explanation, and bounded
evidence data instead of requiring the client to infer those rules.

### Source Separation

`IntentSignalPicker.vue` renders read-only `observed_in_library` values in an
`Already in this library` region. Selectable and disabled options are grouped by
the server-provided source label. A source may be represented even when it is
not yet emitted for native creation, so common options, template suggestions,
custom values, already-declared values, and conflicts do not visually collapse
into observed evidence.

Only current-library suggestions that satisfy the normalized native draft
contract can be selected in this first slice. Ratings and unsupported values
remain evidence, not purpose rules. A disabled source remains visible only with
a server-provided reason.

### Typed Local Draft Commands

`policyIntentSignalDraft.js` checks the normalized source, state, question,
signal type, operator, explicit-acceptance flag, command ID, explanation, and
no-auto-declare rule before it creates a plan. The picker emits the plan; the
draft composable applies it locally; the existing native-create endpoint remains
the only persistence boundary.

## Pros And Cons

### Source-Labeled Multi-Select

Pros:

- Makes a library observation visibly different from an operator-declared rule.
- Lets an operator accept several supported identity signals in one action.
- Keeps unavailable or already-declared options explainable rather than silent.

Cons:

- Each usable value carries more structured metadata than a generic dropdown.
- The initial native-create slice intentionally exposes only server-projected
  observed suggestions; common and custom option providers remain future work.

### Client-Side Command Validation

Pros:

- Prevents accidental raw draft mutation and keeps selection testable.
- Gives immediate invalid-option filtering before a save attempt.

Cons:

- It complements, rather than replaces, server validation at policy creation.
- The local draft is intentionally transient and resets when the selected
  library changes.

## Final Recommendation Stack

1. Normalize every emitted option on the server and retain the normalized fields
   in the read projection.
2. Render observations as read-only evidence and source-labelled candidates as
   selectable or disabled options.
3. Use native checkbox groups for independent multi-select choices with a
   visible legend and an announced local status message.
4. Emit allowlisted typed draft commands only; never mutate draft or legacy
   bridge payloads from the picker.
5. Keep server-side native-intent validation and atomic creation as the durable
   authority boundary.

## Verification

- `server/src/__tests__/services/policyObservedSuggestionCandidates.test.mjs`
- `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs`
- `client/src/__tests__/IntentSignalPicker.test.js`
- `client/src/__tests__/utils/policyIntentSignalDraft.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

The normal new-policy path now has a dedicated intent-signal control that shows
what is evidence, what is selectable, and what has become a local declared
signal. The browser remains non-authoritative: it cannot auto-declare intent,
write policy storage, route media, or reinterpret library evidence.
