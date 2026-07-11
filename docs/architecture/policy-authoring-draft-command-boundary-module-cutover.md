# Policy Authoring Draft Command Boundary Module Cutover

Date: 2026-07-10

## Purpose

This document records the module-level cutover from phase-coded draft command
boundary names to durable policy-authoring names. The goal is to keep the
active architecture readable while preserving the existing compatibility bridge
until its own component family is refactored.

## Official Research Inputs

- Vue component events documentation recommends explicit event contracts and
  runtime payload validation:
  https://vuejs.org/guide/components/events.html
- Vue component `v-model` documentation describes explicit state binding
  contracts:
  https://vuejs.org/guide/components/v-model.html
- OWASP Input Validation guidance recommends syntax and semantic validation at
  trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing assignable fields:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST SSDF SP 800-218 recommends defined security requirements and verified
  implementation criteria:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Decision

The command boundary now uses durable product names:

- `server/src/services/policyAuthoringDraftCommandBoundary.mjs`
- `server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs`
- `docs/architecture/policy-authoring-draft-command-boundary.md`

Two small adapters isolate remaining compatibility dependencies:

- `policyAuthoringBridgeSerializer.mjs`
- `policyAuthoringDraftFieldContract.mjs`

This avoids leaking old phase-coded bridge names into the command boundary while
keeping the refactor scoped to one component family.

## Pros And Cons

Pros:

- Removes phase-coded names from the active command boundary contract.
- Keeps direct consumers pointed at a stable policy-authoring module.
- Avoids broad bridge refactors before the bridge component family is selected.
- Makes command diagnostics product-facing.

Cons:

- The wrappers still depend on compatibility modules that retain old names.
- Other not-yet-cutover families may still alias the command IDs into their own
  local phase-coded tests until those families are refactored.

## Implemented Outcome

- The phase-coded command boundary service, focused test, and design document
  were replaced by durable policy-authoring paths.
- Command audit risks now use `missing_product_command_target`.
- Validation and audit messages now describe policy authoring, reserved
  commands, and product command targets.
- Direct service consumers import from
  `policyAuthoringDraftCommandBoundary.mjs`.

## Next Component

Cut over the draft view projection family so read models consumed by UI cards
use durable policy-authoring names and do not freeze the old diagnostic UI.
