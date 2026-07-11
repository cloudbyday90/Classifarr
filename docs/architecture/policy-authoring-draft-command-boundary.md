# Policy Authoring Draft Command Boundary

Date: 2026-06-30
Updated: 2026-07-10

## Purpose

Policy authoring draft edits must move through a narrow command boundary. The
UI can offer simple controls, multi-select boxes, and library-derived helpers,
but every mutation must be expressed as product intent instead of legacy storage
shape.

This document defines the durable draft command contract. It does not execute
routing, generate evidence, or make client draft state durable authority.

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
   they remain behind product-facing command targets.

4. Reserve unsupported commands without implementing side effects.
   `set_routing_target` and `acknowledge_warning` are stable product terms, but
   they remain blocked until server authority and persistence are defined.

5. Support batched values without exposing bridge internals.
   Multi-select controls can send one command containing an array of values.
   The bridge remains responsible for compatibility serialization.

6. Make command inventory drift executable.
   The boundary should fail if commands gain unsafe categories, payload
   authority, unsupported implementations, read-only projection mutation, or
   raw legacy terminology.

## Pros And Cons

Pros:

- Gives the UI a simple command vocabulary while preventing arbitrary payload
  mutation.
- Supports multi-select UX without requiring legacy bridge changes.
- Keeps evidence/readiness projections read-only.
- Makes compatibility adapter targets explicit before persistence changes.
- Converts security guidance into executable tests.

Cons:

- Adds a server-side contract while some client paths still use legacy bridge
  modules.
- Reserved commands are visible in the contract but intentionally not
  executable.
- Runtime command execution still remains in the existing draft state and
  bridge modules until those families are cut over.

## Final Recommendation Stack

- Server-owned command inventory:
  `server/src/services/policyAuthoringDraftCommandBoundary.mjs`
- Compatibility serializer adapter:
  `server/src/services/policyAuthoringBridgeSerializer.mjs`
- Draft field contract adapter:
  `server/src/services/policyAuthoringDraftFieldContract.mjs`
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
- Reserved commands:
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

The boundary now provides:

- a command inventory grouped by operator edit, bridge system,
  compatibility-adapter, and reserved operator-edit categories,
- validation for command payload shape,
- multi-value support for multi-select controls,
- a compatibility serializer field allow-list,
- read-only evidence/readiness projection protection,
- product command targets for compatibility adapters:
  - `set_signal_config` -> `configure_signal`,
  - `set_signal_metadata` -> `configure_constraint_behavior`,
  - `set_signal_removal` -> `ignore_template_signal`,
- an executable command-boundary audit:
  - `validatePolicyAuthoringDraftCommandRecord(record)` checks a single inventory
    record,
  - `buildPolicyAuthoringDraftCommandBoundaryAudit(options)` checks the whole
    command inventory,
  - the audit fails unknown commands, unknown categories, unknown payload
    authority, implemented commands outside the draft-state allow-list,
    reserved commands that accidentally become implemented, operator edits that
    stop using product-intent payloads, bridge or compatibility adapter commands
    that become operator-facing, batch support outside product intent, read-only
    projection mutation, raw legacy terms in operator-facing command labels, and
    compatibility adapter commands with no product command target.

## Verification

Focused tests:

- `server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs`

These tests assert that:

- unknown commands fail before serialization,
- incomplete payloads fail,
- raw legacy compatibility payloads are rejected,
- arbitrary compatibility fields are rejected,
- read-only evidence/readiness projections cannot be mutated,
- reserved routing commands remain declarative and blocked,
- batched multi-select-style values are accepted by typed signal commands,
- compatibility adapter product targets are visible,
- command inventory drift fails before later UI or bridge work depends on it.

## Next Component

Continue with the policy authoring draft view projection cutover. That task
should define the read model consumed by product components so UI cards stop
needing knowledge of bridge payload shape, legacy naming, or save serialization
details.
