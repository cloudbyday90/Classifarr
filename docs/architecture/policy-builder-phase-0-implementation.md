# Policy Builder Phase 0 Implementation

Status: implemented as the first UI-language and compatibility slice.

## Scope

Phase 0 keeps the existing preset-backed policy storage intact while changing the
operator-facing language toward the intent-and-application model:

```text
The media server shows how this library is used today.
The policy explains what should belong going forward.
```

This slice does not change scoring, routing, API payloads, database schema, or
legacy preset compatibility.

## Research Inputs

- W3C WAI Forms Tutorial, Labels: clear labels and associated instructions make
  form controls easier to understand and operate.
  <https://www.w3.org/WAI/tutorials/forms/labels/>
- GOV.UK Design System, Text input: labels should be clear, and hint text should
  explain how to answer without replacing the label.
  <https://design-system.service.gov.uk/components/text-input/>
- OWASP Input Validation Cheat Sheet: validate structured input with explicit
  allowlists and server-side constraints rather than trusting free-form client
  input.
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- Microsoft Human-AI Experience Toolkit: AI-assisted flows should make system
  capability, uncertainty, and user control understandable.
  <https://www.microsoft.com/en-us/haxtoolkit/>

## Recommendations

1. Use short, task-oriented labels for the intent buckets.
2. Put precision in helper text, not in long section names.
3. Keep starter-template details available, but do not make them the primary
   mental model.
4. Preserve the legacy `customSignals` payload until native intent storage has
   parity tests, replay proof, and rollback proof.
5. Treat browser changes as presentation only; server-side validation and
   scoring authority remain the security boundary.

## Pros and Cons

### Pros

- Reduces policy-builder jargon without risking existing saved policies.
- Makes library usage easier to understand before deeper storage migration.
- Gives future phases stable language for intent drafts, previews, and learning
  guards.
- Keeps advanced details discoverable for operators who need them.

### Cons

- The API and saved payload still use legacy preset naming internally.
- Advanced template details still expose some low-level signal mechanics.
- The media-server role split is explained but not configurable yet.

## Final Stack

- UI copy lives in `client/src/components/policies/PolicyIntentEditor.vue`.
- Advanced starter-template copy lives in
  `client/src/components/policies/PolicyBuilderModal.vue`.
- Existing `customSignals` save behavior remains unchanged.
- Regression coverage lives in `client/src/__tests__/PolicyBuilderModal.test.js`.
- Future native intent storage remains planned for Phase 8 after parity.

## Implemented Outcome

- Renamed visible intent sections:
  - `Identity Signals` -> `Belongs Here`
  - `Compatibility Signals` -> `Helpful Matches`
  - `Strict Constraints` -> `Hard Limits`
  - `Boosters` -> `Boosts`
  - `Exclusions` -> `Avoid`
- Renamed selected policy attachments from `Selected Presets` to
  `Starter Templates`.
- Renamed the advanced template action from `Customize` to `Details`.
- Added static copy explaining that media-server contents show current use,
  while policy intent describes what should belong going forward.
- Updated policy-builder tests to assert the new labels while preserving the
  existing structured save payload.
