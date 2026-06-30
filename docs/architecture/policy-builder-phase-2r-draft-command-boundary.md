# Policy Builder Phase 2R Draft Command Boundary

Date: 2026-06-30

## Purpose

Phase 2R.3 defines draft editing as a command boundary. The policy builder may
offer simple controls, multi-select boxes, and future library-derived helpers,
but every mutation must pass through narrow commands that express product
intent rather than legacy storage shape.

This document covers the implemented Phase 2R.3 contract only. It does not
change current save behavior, execute routing, generate evidence, or move
policy authority out of server validation.

## Official Research Inputs

- Vue component events documentation recommends declaring emitted events and
  supports runtime validation of emitted payloads:
  https://vuejs.org/guide/components/events.html
- Vue component `v-model` documentation covers explicit two-way binding
  contracts for component state:
  https://vuejs.org/guide/components/v-model.html
- Vue composables documentation frames reusable stateful logic as an explicit
  extraction boundary:
  https://vuejs.org/guide/reusability/composables.html
- OWASP Input Validation guidance favors validating syntax and semantics at
  trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing bindable fields
  rather than accepting arbitrary object properties:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST SSDF SP 800-218 emphasizes secure design, reviewable implementation
  criteria, and verification tasks:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep draft edits command-based.
   Product components should emit or call typed actions such as `add_signal`,
   `remove_signal_value`, `set_signal_config`, and `clear_signal_config`.

2. Validate before draft mutation and serialization.
   Invalid commands, incomplete payloads, raw `customSignals` payloads,
   read-only projection writes, and routing side-effect requests should fail
   before touching draft state or the legacy bridge.

3. Treat bridge commands as compatibility adapters.
   `set_signal_metadata` and `set_signal_removal` are necessary today, but
   they are not clean product commands. They are marked for Phase 6R rename or
   split work.

4. Reserve future commands without implementing side effects.
   `set_routing_target` and `acknowledge_warning` are reserved names so future
   UI work can use stable product terms, but they remain blocked until a later
   phase defines server authority and persistence.

5. Support batched values without exposing bridge internals.
   Multi-select controls can send one command containing an array of values.
   The legacy bridge remains responsible for serialization.

## Pros And Cons

Pros:

- Gives the UI a simple command vocabulary while preventing arbitrary payload
  mutation.
- Supports future multi-select UX without rewriting the legacy bridge.
- Keeps evidence/readiness projections read-only.
- Makes Phase 6R rename/split work explicit before the engine refactor.
- Converts security guidance into executable tests.

Cons:

- Adds another server-side contract before the client fully consumes it.
- Current client functions still use some legacy-influenced names until Phase
  6R.
- Future commands are visible in the contract but intentionally not executable.

## Final Recommendation Stack

- Server-owned command inventory:
  `server/src/services/policyBuilderPhase2DraftCommandBoundary.mjs`
- Current implemented commands:
  - `sync_from_selected_presets`
  - `build_selected_presets_from_draft`
  - `apply_draft_to_selected_presets`
  - `add_signal`
  - `remove_signal_value`
  - `set_signal_config`
  - `clear_signal_config`
  - `set_signal_metadata`
  - `set_signal_removal`
- Future reserved commands:
  - `set_routing_target`
  - `acknowledge_warning`
- Validation stance:
  - fail closed on unknown commands,
  - require command-specific payload fields,
  - allow-list compatibility config keys,
  - reject raw legacy payload keys,
  - reject read-only projection mutation,
  - reject routing side-effect requests.

## Implemented Outcome

The Phase 2R.3 boundary now provides:

- a command inventory grouped by operator edit, bridge system,
  compatibility-adapter, and future operator-edit categories,
- validation for command payload shape,
- multi-value support for future multi-select controls,
- a compatibility serializer field allow-list,
- read-only evidence/readiness projection protection,
- explicit Phase 6R rename/split candidates:
  - `set_signal_config` -> `configure_signal`,
  - `set_signal_metadata` -> `configure_constraint_behavior`,
  - `set_signal_removal` -> `ignore_template_signal`.

## Verification

Focused tests:

- `server/src/__tests__/services/policyBuilderPhase2DraftCommandBoundary.test.mjs`

These tests assert that:

- unknown commands fail before serialization,
- incomplete payloads fail,
- raw legacy compatibility payloads are rejected,
- arbitrary compatibility fields are rejected,
- read-only evidence/readiness projections cannot be mutated,
- future routing commands remain declarative and blocked,
- batched multi-select-style values are accepted by typed signal commands,
- Phase 6R rename/split candidates are visible.

## Next Phase

Continue with Phase 2R.4 Draft View Projection. That task should define the
read model consumed by product components so UI cards stop needing knowledge of
bridge payload shape, legacy naming, or save serialization details.
