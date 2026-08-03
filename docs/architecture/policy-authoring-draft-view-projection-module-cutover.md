# Policy Authoring Draft View Projection Module Cutover

Date: 2026-07-10

## Purpose

This document records the module-level cutover from phase-coded draft view
projection names to durable policy-authoring names. The goal is to keep the
active read model understandable after the refactor phases are no longer useful
context.

## Official Research Inputs

- Vue computed properties documentation states computed getters should be pure
  and side-effect free:
  https://vuejs.org/guide/essentials/computed.html
- Vue component events documentation supports explicit emitted-event contracts
  and runtime validation:
  https://vuejs.org/guide/components/events.html
- OWASP Input Validation guidance recommends syntactic and semantic validation
  at trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing assignable fields:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST SSDF SP 800-218 recommends reviewable secure design and verification:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Decision

The draft view projection now uses durable product names:

- `server/src/services/policyAuthoringDraftViewProjection.mjs`
- `server/src/__tests__/services/policyAuthoringDraftViewProjection.test.mjs`
- `docs/architecture/policy-authoring-draft-view-projection.md`

The projection consumes draft field and authority ids through
`policyAuthoringDraftFieldContract.mjs`, keeping old compatibility module names
out of the active projection contract.

## Pros And Cons

Pros:

- Removes phase-coded names from the active draft view projection contract.
- Keeps the read model side-effect free and server-audited.
- Aligns downstream tests and parity inventories with the durable test path.
- Leaves not-yet-cutover bridge and server-authority families scoped to their
  own component work.

Cons:

- The draft field adapter still wraps a not-yet-cutover contract module.
- Adjacent server-authority documentation still references the old family until
  its cutover is performed.

## Implemented Outcome

- The phase-coded draft view projection service, focused test, and design
  document were replaced by policy-authoring paths.
- View projection constants, lookup helpers, validators, summaries, and audits
  now export durable names.
- Validation messages now describe the policy authoring view/provenance
  vocabulary.
- Direct server-authority and parity consumers now reference the durable test
  and service paths.

## Next Component

The former preparation family is retired. The active successor is the
server-owned policy intent authority contract, which keeps client draft state
non-authoritative while native storage is active.
