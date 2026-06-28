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

## Seventh Implemented Component

The seventh implemented component adds a non-persistent native intent impact
preview API:

1. Add `server/src/services/policyIntentImpactPreview.mjs` as the comparison
   boundary between legacy `policyConfigurationView` output and a validated
   native draft.
2. Add `POST /api/policies/intent/impact-preview` as a side-effect-free route
   that validates the native draft before any preset lookup, enriches selected
   preset IDs from `content_presets`, and never writes policy storage.
3. Compare bucket counts and behavior-relevant signal fingerprints for
   identity, compatibility, strict constraints, boosters, and exclusions.
4. Return only sanitized preview metadata: counts, changed buckets, reason
   codes, parity, impact level, validation status, and non-persistence mode.
5. Do not return raw draft bodies, raw preset JSON, raw values, prompts,
   classification examples, API keys, traces, or storage migration commands.
6. Add `previewPolicyIntentImpact()` to the client API layer so a later modal UX
   slice can consume the preview without raw HTTP calls.

This component gives the platform a measurable parity gate before native intent
storage. It answers "would this draft materially change policy intent?" without
making that draft authoritative yet.

## Eighth Implemented Component

The eighth implemented component adds modal-facing impact preview UX:

1. Add `client/src/utils/policyIntentImpactPreview.js` as the browser-side
   sanitizer for preview responses, notice copy, and changed-bucket summaries.
2. Add `client/src/composables/usePolicyIntentImpactPreview.js` as the async
   preview state boundary with injected API and payload builder dependencies.
3. Add `PolicyIntentImpactPreviewCard.vue` as the read-only display surface for
   preview state, parity, impact level, changed buckets, loading, and bounded
   errors.
4. Wire `PolicyBuilderModal.vue` to run preview using the same
   `buildSavePayload()` shape used by create/update, including the
   `policyIntentDraft` sidecar.
5. Keep preview refresh separate from save. Preview does not block save, does
   not persist state, and does not change the existing create/update event
   contract.
6. Keep browser-visible output sanitized: no raw draft body, raw preset JSON,
   prompt text, examples, credentials, route traces, or storage commands.

This component gives operators the first before-save parity check in the policy
builder without making native intent authoritative or changing policy storage.

## Ninth Implemented Component

The ninth implemented component adds stale-preview tracking:

1. Add deterministic save-payload fingerprinting in
   `usePolicyIntentImpactPreview` using sorted JSON serialization.
2. Record the payload fingerprint that produced the latest successful preview.
3. Compare that fingerprint to a reactive `buildSavePayload()` projection from
   the modal.
4. Keep the previous preview visible after edits, but mark it stale when the
   current draft no longer matches the previewed payload.
5. Surface a bounded stale-state warning in `PolicyIntentImpactPreviewCard`
   with an explicit refresh action.
6. Keep stale tracking client-only and non-persistent. It does not block save,
   change server preview output, or store draft fingerprints in the database.

This component prevents operators from treating an old parity result as current
after editing intent, while preserving the preview as useful context.

## Tenth Implemented Component

The tenth implemented component adds representative replay readiness:

1. Add `server/src/services/policyIntentReplayPreview.mjs` as the read-only
   replay-preview boundary.
2. Add `POST /api/policies/intent/replay-preview` to validate the native intent
   draft, reuse the structural impact preview, and then fetch a bounded sample
   of recent classifications for the selected library.
3. Keep replay preview explicitly non-executing:
   - no classification run,
   - no AI call,
   - no web-search/provider call,
   - no Radarr/Sonarr write,
   - no policy persistence.
4. Use parameterized classification-history sample queries with deterministic
   ordering and a capped sample limit.
5. Return sanitized item context only: title, year, media type, current library
   name, confidence, method, status, outcome class, and creation time.
6. Exclude raw IDs, `tmdb_id`, metadata, reasoning text, traces, prompts,
   draft bodies, provider payloads, and persistence commands from browser
   output.
7. Add `previewPolicyIntentReplay()` to the client policy API layer so the next
   UI slice can consume the endpoint without raw HTTP calls.

This component gives operators and future UI work a safe "what evidence would
we replay against?" view before the platform attempts actual representative
classification simulation or native intent storage migration.

## Research Inputs

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html):
  OpenAPI exists so clients and servers can understand an HTTP API without
  guessing from implementation details. Phase 5 follows that principle by
  making policy intent response shape explicit and versioned.
- [PostgreSQL `LIMIT` and `OFFSET` documentation](https://www.postgresql.org/docs/current/queries-limit.html):
  PostgreSQL recommends pairing limited result sets with a deterministic order
  when predictable rows matter. Replay readiness uses `ORDER BY created_at, id`
  with a bounded `LIMIT` so preview samples are stable and inexpensive.
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
- [Vue State Management](https://vuejs.org/guide/scaling-up/state-management.html):
  shared state should be explicit and predictable. The preview API is exposed as
  a named client function first so the later UI component can keep preview state
  separate from save state.
- [Vue Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html):
  component-local state should stay explicit and reactive. The preview slice
  keeps `preview`, `loading`, and `error` in a composable instead of deriving
  hidden side effects from save.
- [Vue Watchers](https://vuejs.org/guide/essentials/watchers.html):
  watchers are intended for side effects in response to reactive changes. The
  stale-preview slice avoids destructive watcher side effects and instead uses
  computed fingerprint comparison so previous preview context remains visible.
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
- Add impact preview before storage migration. Preview should compare sanitized
  legacy and native-draft intent summaries, not run classification scoring or
  persist draft data.
- Surface impact preview in the modal as an explicit operator action, not an
  automatic save prerequisite. This keeps save behavior stable while making
  parity visible before storage migration.
- Normalize impact preview responses before rendering. Browser components
  should consume bounded notice and changed-bucket summaries, not raw server
  payloads.
- Track whether the displayed preview still matches the current draft. Stale
  preview state should be derived from a deterministic payload fingerprint and
  surfaced as guidance, not as a hidden save blocker.
- Add replay readiness before real replay execution. The first endpoint should
  prove validation, sampling, sanitization, and no-execution semantics before
  any runtime scoring path is reused.
- Keep representative replay samples bounded and parameterized. Do not expose
  raw classification history rows or allow unbounded library scans from the
  browser.
- Keep replay preview output explicit about what did not run. The response
  should carry no-execution flags so UI and tests cannot confuse sample
  readiness with a completed classification simulation.
- Treat identity, strict-constraint, and exclusion drift as high impact because
  those buckets can change routing safety and review behavior.
- Keep preview routes side-effect free and validate the draft before any
  database reads that are not necessary for validation.
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
- The first impact preview compares policy intent structure, not full
  classification outcomes. It is a parity gate, not a replacement for later
  representative-classification simulation.
- Stale tracking uses a browser-side payload fingerprint. It is a UX guardrail,
  not an audit record, and should not be treated as proof of server parity.
- Replay readiness confirms only that the platform can safely choose and
  display representative samples. It does not yet score those samples against
  the draft intent.
- The sample query reads classification history, so empty or newly created
  libraries may report `no_samples` until history exists.

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

Focused impact preview validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentImpactPreview.test.mjs|policyIntentRequestValidator.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
cd client && node scripts/run-vitest.mjs run src/__tests__/api/policiesApi.test.js src/__tests__/api/barrelExports.test.js
```

Focused modal preview UX validation:

```bash
cd client && node scripts/run-vitest.mjs run src/__tests__/utils/policyIntentImpactPreview.test.js src/__tests__/composables/usePolicyIntentImpactPreview.test.js src/__tests__/PolicyIntentImpactPreviewCard.test.js src/__tests__/PolicyBuilderModal.test.js
```

Focused replay-readiness validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentReplayPreview.test.mjs|policyIntentImpactPreview.test.mjs|policyIntentRequestValidator.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
cd client && node scripts/run-vitest.mjs run src/__tests__/api/policiesApi.test.js src/__tests__/api/barrelExports.test.js
```

## Next Work

The next Phase 5 slice should add the modal-facing replay preview panel. The
server can now return a sanitized, non-executing sample report; operators still
need a browser surface that explains sample readiness alongside the existing
impact preview before any real scoring replay or native storage migration.
