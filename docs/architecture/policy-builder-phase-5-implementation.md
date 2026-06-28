# Policy Builder Phase 5 Implementation

Status: in progress
Scope: server-side policy intent contract, read-only compatibility projection

## Goal

Phase 5 makes policy intent a server-owned contract instead of only a client UI
projection. The first slice does not add database storage and does not change
classification scoring. It validates the contract that is already derived from
legacy preset-backed policies.

The contract must answer:

```text
What intent does the server believe this policy expresses?
Is that intent complete, partial, or empty?
Which fields are safe for the client and future runtime logic to consume?
```

## First Implemented Component

The first implemented component adds schema validation for the read-only intent
contract:

1. Add `server/src/services/policyIntentSchema.mjs` as the canonical schema
   boundary for Phase 5 contract metadata, roles, collections, signal types,
   operators, and validation rules.
2. Keep `server/src/services/policyIntentContract.mjs` responsible for mapping
   legacy preset/configuration-view state into the contract.
3. Add `validation` metadata to each generated `policy_intent_contract` so
   client and future server consumers can distinguish valid, warning-only, and
   invalid contract shapes.
4. Enforce the first server-side semantic boundaries:
   - `purpose` uses identity-capable signals only,
   - `hard_limits` require strict constraints,
   - `helpful_hints` cannot be strict,
   - `avoid` entries should be exclusion-shaped.
5. Keep unsupported legacy preset signals represented as partial inference
   warnings, not fatal policy loading errors.

## Second Implemented Component

The second implemented component extracts policy response projection into a
single mapper boundary:

1. Add `server/src/services/policyIntentMapper.mjs` as the route-facing
   projection helper.
2. Keep `configuration_view` and `policy_intent_contract` composition out of
   read/create/update route handlers.
3. Preserve the existing response shape by returning both projection fields on
   detailed policy read/create/update responses.
4. Reuse precomputed projection objects when available so later phases can
   avoid duplicate work during preview, validation, or native-intent migration
   flows.
5. Keep list responses lightweight for now. They still return policy summary
   rows and preset counts, not full intent contracts.

This is a structural refactor, not a scoring or persistence change.

## Third Implemented Component

The third implemented component locks route response parity around the server
projection:

1. Detailed policy read, create, and update responses must include both
   `configuration_view` and `policy_intent_contract`.
2. Each detailed response must carry a valid generated intent contract with
   bounded validation metadata.
3. Policy list responses intentionally remain lightweight and do not include the
   detailed projection fields.
4. Route tests now assert those boundaries directly so future route refactors
   cannot accidentally drop the server-owned contract or expand list payloads
   without an explicit design decision.

This keeps API behavior predictable while Phase 5 is still running on legacy
preset-backed storage.

## Fourth Implemented Component

The fourth implemented component adds write-side native intent draft request
validation without enabling storage:

1. Add `server/src/services/policyIntentRequestValidator.mjs` as the DTO
   boundary for future native intent write requests.
2. Validate both `policy_intent_draft` and current client-style
   `policyIntentDraft` candidates through one helper.
3. Require schema version `1`, known draft sources, known preset fields, known
   bucket names, known signal types, known value operators, bounded strings,
   bounded arrays, and bounded serialized payload size.
4. Reject unknown top-level, preset, bucket, metadata, and values fields so
   native intent writes cannot become a mass-assignment path.
5. Enforce the first write-side semantic guardrails:
   - strict-constraint bucket entries must carry strict metadata,
   - avoid bucket entries must use `exclude` values or `exclude` mode,
   - summary preset counts must match the draft preset array.
6. Return `persistence_enabled: false` and
   `persistence_reason_code: native_intent_storage_not_enabled` from the write
   payload helper. This makes the helper safe to wire into later route preflight
   flows before any migration or storage write exists.

This component validates future input shape only. It does not change policy
create/update behavior, does not persist native intent, and does not affect
classification scoring.

## Fifth Implemented Component

The fifth implemented component wires native intent draft validation into policy
create/update routes as a non-persistent preflight:

1. Add `buildPolicyIntentWritePreflight` to the write DTO validator so route
   handlers can return a sanitized diagnostic without echoing raw draft content.
2. Accept both `policyIntentDraft` and `policy_intent_draft` on create/update
   requests.
3. Reject invalid native intent drafts with a bounded `400` response before any
   policy transaction, preset replacement, or database mutation runs.
4. Return `policy_intent_write_preflight` on successful create/update responses
   only when a native draft was submitted.
5. Keep `persistence_enabled: false` and
   `persistence_reason_code: native_intent_storage_not_enabled` in the response
   diagnostic until a later explicit native storage migration exists.
6. Do not persist the native draft, do not echo the draft body, and do not use it
   for classification scoring.

This component gives clients a server-owned save-path compatibility check while
preserving the legacy preset/custom-signal storage contract.

## Sixth Implemented Component

The sixth implemented component makes the client participate in the write
preflight contract without changing persistence:

1. The policy builder save payload now sends a cloned `policyIntentDraft`
   sidecar alongside the existing legacy-compatible `presets` payload.
2. `usePolicyBuilderState` remains the state boundary that produces both
   shapes, keeping the modal focused on intent editing and save emission.
3. `policyIntentWritePreflight.js` normalizes the server response before UI
   display so raw server diagnostics do not leak into component state.
4. `PolicyList.vue` consumes `policy_intent_write_preflight` from create/update
   responses and displays a bounded compatibility notice when the server
   validates the draft but native intent storage remains disabled.
5. Invalid drafts still fail server-side before mutation; valid drafts are still
   saved only through the legacy preset/custom-signal path until a later native
   storage migration is explicitly implemented.

This component closes the first client/server loop for native intent drafts:
the client submits the draft, the server validates it, and the UI tells the
operator exactly whether the save used compatibility mode.

## Research Inputs

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html):
  OpenAPI exists so clients and servers can understand an HTTP API without
  guessing from implementation details. Phase 5 follows that principle by
  making policy intent response shape explicit and versioned.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  structured data should be validated with allow-listed expected values. Phase
  5 uses explicit enums for sources, inference states, roles, signal types,
  operators, constraint modes, and semantics.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  REST APIs should validate content and avoid trusting client-controlled data.
  The first Phase 5 slice validates the server-generated read contract before
  later phases use it for writes or runtime decisions.
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html):
  API write DTOs should allow-list bindable fields and avoid binding raw input
  directly to domain objects. The write preflight validator rejects unexpected
  fields, the route preflight runs before mutation, and the response diagnostic
  does not expose native storage.
- [Vue Component Events](https://vuejs.org/guide/components/events.html):
  child components emit events upward and parent components own the side effects.
  The policy builder modal emits the combined save payload, while `PolicyList`
  remains responsible for API calls and response diagnostics.
- [Zod Documentation](https://zod.dev/api):
  Zod schemas provide runtime validation for nested data contracts. Phase 5 uses
  Zod for the future native intent write DTO because the server already uses it
  for provider contracts and it supports strict object schemas with bounded
  nested refinement.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework):
  AI-adjacent systems need governance, traceability, and measurable controls.
  The intent contract validation is a traceable control between UI intent,
  server policy state, and later runtime AI/question behavior.

## Recommendation Stack

- Keep the first server-side intent contract read-only and additive.
- Validate the server-generated contract before clients or runtime services rely
  on it.
- Keep mapping and validation in separate ES modules:
  - mapper/contract projection owns legacy interpretation,
  - schema validation owns supported contract shape and semantic boundaries.
- Keep route handlers thin. They should fetch policy rows and presets, then call
  the projection boundary instead of knowing how `configuration_view` and
  `policy_intent_contract` are composed.
- Treat detailed and list policy responses as separate API contracts. Detailed
  responses can include the full intent projection; list responses should stay
  summary-only unless an explicit projection mode is added.
- Add write-side DTO validation before persistence. Native intent draft input
  should be parsed into an allow-listed shape and explicitly marked
  non-persistent until migration work exists.
- Wire write validation into create/update as a preflight before storage. Valid
  drafts may return a sanitized diagnostic; invalid drafts must fail before DB
  mutation.
- Keep the preflight response intentionally small: schema version, source,
  migration state, preset count, validation state, and persistence reason only.
- Submit the native draft as a cloned sidecar from the client. The legacy
  preset/custom-signal payload remains authoritative for persistence until the
  migration phase is complete.
- Normalize the write preflight response before UI rendering. The page can show
  a compatibility-mode notice, but it should not expose raw draft content or
  treat non-persistence as a save failure.
- Treat unsupported legacy preset data as `partial` inference with warnings
  unless it makes the generated contract itself invalid.
- Keep validation output bounded and non-sensitive. Do not include raw preset
  JSON, prompts, API keys, item metadata, or route traces in validation errors.
- Do not add native intent storage until the read contract is stable and impact
  preview can compare legacy versus native behavior.

Pros:

- Reduces client/server semantic drift without a database migration.
- Gives future Phase 5B/5C runtime question work a stable server-owned intent
  source.
- Makes partial legacy inference visible instead of silently pretending every
  preset maps cleanly.
- Keeps existing policies loadable even when legacy signals are unsupported by
  the new intent model.
- Reduces route duplication before native intent storage or runtime
  clarification logic starts consuming the same contract.
- Prevents accidental payload drift between read, create, and update responses
  before clients depend more heavily on the server-owned intent contract.
- Creates a safe write preflight path before any native intent draft can be
  persisted or influence runtime classification decisions.

Cons:

- The contract is still inferred from legacy preset/custom-signal storage.
- Validation metadata is additive, but clients must avoid treating it as a save
  blocker until server write validation exists.
- The first validator is intentionally conservative and may need new supported
  signal/operator enums as more policy concepts become first-class.
- Keeping list responses lightweight means list-based UI surfaces cannot consume
  full intent details until an explicit opt-in projection mode exists.
- The native draft validator currently accepts the compatibility draft DTO but
  does not convert or store it.
- The route preflight makes valid native draft presence visible to clients, but
  clients still need to treat it as non-persistent until native storage is
  explicitly implemented.
- The client now sends a larger create/update payload because it carries both
  legacy presets and the native draft sidecar.
- Compatibility notices add one more UI state after save; the message must stay
  concise so it clarifies persistence mode without alarming operators.

## Validation

Schema validation:

```bash
npm --prefix server test -- policyIntentSchema.test.mjs policyIntentContract.test.mjs
```

Focused policy projection and route validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentMapper.test.mjs|policyIntentSchema.test.mjs|policyIntentContract.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
```

Focused write preflight validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentRequestValidator.test.mjs" --no-coverage
```

Focused write route preflight validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentRequestValidator.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
```

Focused client write preflight consumption:

```bash
cd client && node scripts/run-vitest.mjs run src/__tests__/utils/policyIntentWritePreflight.test.js src/__tests__/composables/usePolicyBuilderState.test.js src/__tests__/PolicyBuilderModal.test.js
```

## Next Work

The next Phase 5 slice should add an explicit server/client impact preview for
native intent drafts. Before storage migration, operators need a way to compare
the legacy preset/custom-signal interpretation against the native draft
interpretation and see whether classification behavior would materially change.
