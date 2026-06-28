# Policy Builder Phase 5 Implementation

Status: implementation checkpoint complete for the non-persistent server intent
bridge
Scope: server-side policy intent contract, read-only compatibility projection,
write preflight, impact preview, and representative replay preview

## Goal

Phase 5 makes policy intent a server-owned contract instead of only a client UI
projection. The first slice does not add database storage and does not change
classification scoring. It validates the contract that is already derived from
legacy preset-backed policies.

Phase 5 is complete for the compatibility bridge it set out to build: the
server can generate, validate, preflight, preview, and replay-check native
intent drafts without making them authoritative or storing them. Native intent
database storage, conversion, and runtime authority remain explicitly gated to
the later storage migration phase.

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

## Eleventh Implemented Component

The eleventh implemented component surfaces replay readiness in the policy
builder modal:

1. Add `client/src/utils/policyIntentReplayPreview.js` as the browser
   normalization boundary for replay-preview responses.
2. Add `client/src/composables/usePolicyIntentReplayPreview.js` to own replay
   preview loading, bounded error, sample, and stale-state tracking.
3. Add `PolicyIntentReplayPreviewCard.vue` as a focused display surface for
   sample readiness, no-execution semantics, and sanitized sample rows.
4. Wire `PolicyBuilderModal.vue` to run replay preview using the same
   `buildSavePayload()` path as impact preview, with a bounded default
   `replay_limit`.
5. Keep replay preview separate from save and separate from structural impact
   preview. Operators can run either preview without mutating policy storage.
6. Keep browser-visible replay output bounded to normalized sample context,
   readiness, impact summary, and explicit no-execution flags.

This component makes representative sample readiness visible to operators while
keeping real scoring replay and native intent storage migration out of scope.

## Twelfth Implemented Component

The twelfth implemented component adds deterministic dry-run signal-fit replay
behind the representative replay panel:

1. Add `server/src/services/policyIntentReplayScoring.mjs` as a focused
   read-only scoring boundary for native intent draft samples.
2. Extend the replay sample query to select `metadata` and `genre_names` for
   server-side evidence extraction only.
3. Keep browser-visible samples sanitized. Raw metadata, identifiers, reasoning,
   traces, prompts, provider payloads, and persistence commands remain excluded
   from the API response.
4. Add `dry_run_scoring` to the replay-preview response with explicit safety
   flags:
   - no full classification run,
   - no AI call,
   - no provider call,
   - no Radarr/Sonarr write,
   - no persistence.
5. Score only native intent signal fit for representative samples:
   - `strong` when identity/compatibility evidence fits and no hard blocks hit,
   - `review` when evidence exists but identity fit is missing or weak,
   - `blocked` when strict constraints or exclusions reject the sample,
   - `insufficient` when stored history lacks usable evidence.
6. Surface compact replay scoring in the modal card so operators can see whether
   recent representative items would remain candidates, need review, be blocked,
   or lack enough evidence.

This is not a full classifier replay. It intentionally avoids profile, RAG,
history, AI rerun, provider enrichment, and Arr routing paths until those
dependencies can be injected behind an explicit dry-run execution context.

## Thirteenth Implemented Component

The thirteenth implemented component adds the full-replay execution context
boundary:

1. Add `server/src/services/policyIntentReplayExecutionContext.mjs` as the
   capability contract for future representative full replay.
2. Default the context to `dry_run_replay` with side effects disabled.
3. Expose no-op adapters for full classification, AI calls, provider calls, Arr
   writes, persistence writes, RAG reads, profile reads, and history reads.
4. Throw structured `POLICY_INTENT_REPLAY_SIDE_EFFECT_BLOCKED` errors when a
   replay path attempts to use a blocked dependency.
5. Serialize a bounded execution summary into dry-run scoring output so tests
   and clients can distinguish signal-fit replay from full classifier replay.
6. Keep trace and correlation fields bounded and allow-listed. Unsafe values are
   dropped from the serialized context instead of echoed to the browser.

This component is intentionally a boundary, not a deeper classifier reuse. It
creates the object future replay code must accept before it can safely call into
profile, RAG, AI, provider, history, or Arr routing services.

## Fourteenth Implemented Component

The fourteenth implemented component adds a replay item adapter:

1. Add `server/src/services/policyIntentReplayItemAdapter.mjs` as the canonical
   conversion boundary from `classification_history` rows into deterministic
   policy-engine item shape.
2. Normalize only bounded server-side fields needed by deterministic scoring:
   title, year, media type, certification, genres, keywords, studios, original
   language, overview, runtime, and vote average.
3. Read indexed history evidence such as `genre_names` and
   `primary_studio_name` before falling back to bounded `metadata` JSONB
   values.
4. Exclude raw history identifiers, `tmdb_id`, metadata JSON, reasoning text,
   traces, prompts, provider payloads, and persistence commands from replay
   items.
5. Refactor dry-run signal-fit scoring to consume replay items instead of
   reparsing raw history rows internally.
6. Keep signal-fit evidence stricter than row evidence. A title-only row is a
   valid history row but remains insufficient for policy signal fit.

This component prepares representative replay for deterministic policy-engine
comparison without enabling profile, RAG, history scoring, AI, providers, Arr
writes, or persistence.

## Fifteenth Implemented Component

The fifteenth implemented component adds deterministic policy-engine preview
comparison:

1. Add `server/src/services/policyIntentReplayEngineComparison.mjs` as the
   adapter between native intent draft buckets and existing policy-engine signal
   scoring primitives.
2. Convert intent entries into policy-engine-compatible signal configs while
   keeping aliases such as `ratings` mapped to `certifications`.
3. Score replay-adapter items with `evaluatePresetSignals` only. The preview
   still does not call full policy evaluation, policy lookup, profile scoring,
   RAG, history scoring, AI, providers, Arr writes, or persistence.
4. Keep strict constraints and exclusions as blocker checks, but only when the
   replay item has relevant evidence for that signal. Sparse or title-only rows
   stay `insufficient` instead of becoming false blockers.
5. Return a bounded `policy_engine` comparison per sample plus a bounded
   `policy_engine_comparison` summary, then normalize those fields in the
   browser before display.
6. Surface the policy-engine score and fit in the representative replay card so
   operators can compare draft-fit text with the deterministic engine score.

This component is still preview-only. It gives the replay panel a real
policy-engine comparison without adopting runtime dependencies or changing save
behavior.

## Sixteenth Implemented Component

The sixteenth implemented component adds replay parity delta summaries:

1. Add `server/src/services/policyIntentReplayParityDelta.mjs` as a bounded
   read model that compares current sanitized sample outcome, draft signal-fit,
   and deterministic policy-engine fit.
2. Return per-sample delta actions:
   - `would_remain`
   - `would_now_candidate`
   - `would_now_review`
   - `would_now_block`
   - `insufficient_evidence`
3. Return aggregate counts for each delta action so operators can evaluate the
   replay impact without reading every sample card.
4. Derive reason codes from bounded state only: current outcome, draft fit,
   policy-engine fit, and sanitized blocker labels.
5. Normalize the delta contract in the browser and display a concise delta
   summary plus per-sample delta action in the replay preview card.
6. Keep the delta preview informational. It does not block save, persist
   anything, run classification, or call AI/provider/Arr dependencies.

This component turns replay from "sample readiness plus score" into a clearer
operator question: would the current representative classifications remain,
become candidates, need review, become blocked, or lack enough evidence?

## Seventeenth Implemented Component

The seventeenth implemented component adds replay sample selection diagnostics:

1. Add `server/src/services/policyIntentReplaySampleDiagnostics.mjs` as the
   aggregate read model for representative sample selection.
2. Keep the diagnostics query parameterized and scoped to a single library and
   optional media type filter.
3. Report bounded counts for total history, eligible history, final-success
   rows, review/pending rows, media-type filtered rows, and sparse-evidence
   rows.
4. Return a sanitized `selection_status` and allow-listed reason codes so empty
   previews can explain whether the library has no history, no eligible media
   type, or no returned samples.
5. Attach diagnostics to `sample.diagnostics` in the replay-preview response
   without exposing classification IDs, TMDB IDs, raw metadata, prompts,
   provider payloads, route traces, SQL, or persistence details.
6. Normalize and display the diagnostics in the replay preview card so
   operators can distinguish "no sample exists" from "the filter excluded the
   available history" before deeper replay dependencies are enabled.

This component is read-only and does not change classification scoring,
policy storage, AI/provider calls, Arr writes, or persistence behavior.

## Eighteenth Implemented Component

The eighteenth implemented component adds replay evidence completeness:

1. Add `server/src/services/policyIntentReplayEvidenceCompleteness.mjs` as a
   per-sample read model built on top of the existing replay item adapter.
2. Reuse the sanitized adapter evidence instead of reparsing raw history rows in
   the route or client.
3. Return a bounded `sample.evidence_completeness` object with aggregate counts
   for strong, partial, and sparse selected samples.
4. Return per-sample field availability only:
   - `rating`
   - `genres`
   - `keywords`
   - `studio`
   - `language`
   - `overview`
   - `runtime`
   - `vote_average`
5. Return small field-count summaries for genres, keywords, and studios so
   operators can see whether list-based evidence exists without seeing the
   values.
6. Normalize and display the completeness summary in the replay preview card,
   including per-sample completeness and available field labels.
7. Do not expose raw ratings, genres, keywords, studios, languages, overview
   text, metadata JSON, IDs, prompts, provider payloads, route traces, SQL, or
   persistence details.

This component closes the gap between "a sample was selected" and "the sample
has enough stored evidence to make replay conclusions useful." It remains
read-only and does not enrich missing evidence.

## Nineteenth Implemented Component

The nineteenth implemented component adds read-only enrichment eligibility:

1. Add `server/src/services/policyIntentReplayEnrichmentEligibility.mjs` as a
   replay-only eligibility read model.
2. Reuse the replay item adapter and selected representative rows. Do not add
   another database read and do not invoke enrichment services.
3. Report whether each sample is:
   - `eligible`
   - `not_needed`
   - `insufficient_identity`
   - `no_safe_source`
4. Report only bounded missing field names and source categories:
   - `tmdb_metadata`
   - `omdb_rating`
   - `web_search_metadata`
5. Carry explicit no-execution flags for provider calls, AI calls, persistence,
   and Arr writes.
6. Normalize and display the enrichment eligibility summary in the replay
   preview card, including per-sample status and source categories.
7. Do not expose TMDB IDs, IMDb IDs, titles, metadata JSON, API keys, provider
   configuration, provider payloads, prompts, route traces, SQL, or persistence
   details.

This component does not enrich anything. It only shows whether a future
replay-specific enrichment adapter might safely improve sparse samples.

## Research Inputs

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html):
  OpenAPI exists so clients and servers can understand an HTTP API without
  guessing from implementation details. Phase 5 follows that principle by
  making policy intent response shape explicit and versioned.
- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/):
  APIs should expose only object properties the caller should read. Replay
  evidence completeness therefore returns field presence and counts, not raw
  classification evidence values.
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  APIs should bound returned records and per-request work. Phase 5 keeps replay
  samples and completeness items capped at the existing replay limit.
- [OWASP API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/):
  APIs should keep privileged operations behind explicit function boundaries.
  Enrichment eligibility is intentionally separated from enrichment execution so
  a preview endpoint cannot become a provider-call or write path.
- [OWASP API8:2023 Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/):
  APIs should avoid exposing unnecessary implementation and configuration
  details. Replay eligibility reports source categories, not provider
  configuration, API keys, request URLs, or identifiers.
- [PostgreSQL `LIMIT` and `OFFSET` documentation](https://www.postgresql.org/docs/current/queries-limit.html):
  PostgreSQL recommends pairing limited result sets with a deterministic order
  when predictable rows matter. Replay readiness uses `ORDER BY created_at, id`
  with a bounded `LIMIT` so preview samples are stable and inexpensive.
- [PostgreSQL JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html):
  PostgreSQL documents JSON/JSONB access as a database-side data extraction
  primitive. The replay scorer reads stored JSONB evidence server-side and then
  emits only bounded summaries to the browser.
- [PostgreSQL Aggregate Expressions](https://www.postgresql.org/docs/current/sql-expressions.html):
  aggregate expressions support count-based summaries without returning every
  matching row. Sample diagnostics use aggregate counts so the browser sees
  bounded availability signals rather than raw classification records.
- [PostgreSQL Arrays](https://www.postgresql.org/docs/current/arrays.html):
  PostgreSQL array columns such as `genre_names` are valid first-class data
  types, but application code still needs bounded normalization before using
  them as replay evidence.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  structured data should be validated with allow-listed expected values. Phase
  5 uses explicit enums for sources, inference states, roles, signal types,
  operators, constraint modes, and semantics.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  REST APIs should validate content and avoid trusting client-controlled data.
  The first Phase 5 slice validates the server-generated read contract before
  later phases use it for writes or runtime decisions.
- [Node.js Async Context](https://nodejs.org/api/async_context.html):
  Node documents async context as a way to carry request-scoped state through
  asynchronous execution. Phase 5 uses an explicit context object first so
  replay capabilities stay visible in function signatures before any later
  async-context bridge is considered.
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html):
  API write DTOs should allow-list bindable fields and avoid binding raw input
  directly to domain objects. The write preflight validator rejects unexpected
  fields, the route preflight runs before mutation, and the response diagnostic
  does not expose native storage.
- [Vue Component Events](https://vuejs.org/guide/components/events.html):
  child components emit events upward and parent components own the side effects.
  The policy builder modal emits the combined save payload, while `PolicyList`
  remains responsible for API calls and response diagnostics.
- [Vue Props](https://vuejs.org/guide/components/props.html):
  components consume explicit props and should not need to understand internal
  server objects. The replay card receives normalized completeness fields rather
  than raw history rows.
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
- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  composables should encapsulate stateful logic for reuse and testing. Replay
  preview state now lives in its own composable instead of expanding the modal
  or impact-preview composable.
- [Zod Documentation](https://zod.dev/api):
  Zod schemas provide runtime validation for nested data contracts. Phase 5 uses
  Zod for the future native intent write DTO because the server already uses it
  for provider contracts and it supports strict object schemas with bounded
  nested refinement.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework):
  AI-adjacent systems need governance, traceability, and measurable controls.
  The intent contract validation is a traceable control between UI intent,
  server policy state, and later runtime AI/question behavior. Dry-run replay
  keeps the measurable control deterministic before adopting full runtime AI
  replay.

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
- Surface replay readiness in a separate card from structural impact. Impact
  preview answers whether the draft structure changed; replay readiness answers
  whether safe representative samples exist.
- Keep replay preview user-triggered. It should not run automatically on every
  draft edit because sample selection is informational and should not become a
  hidden save prerequisite.
- Normalize replay preview responses in the browser even though the server
  sanitizes them. The UI should consume only the fields it intentionally
  displays.
- Add deterministic dry-run signal-fit replay before full classifier replay.
  This gives operators useful evidence from stored samples while keeping
  profile, RAG, AI, provider, and Arr dependencies outside the first scoring
  slice.
- Keep dry-run scoring output separate from sanitized sample rows. Samples show
  current history context; `dry_run_scoring` shows native-draft fit for those
  samples.
- Treat hard exclusions and strict constraints as blocking in replay scoring.
  Identity and compatibility evidence can support a candidate but must not
  override safety blocks.
- Add a first-class replay execution context before full classifier replay.
  Future replay code should receive capabilities and adapters explicitly instead
  of reaching directly into AI, provider, RAG, profile, history, persistence, or
  Arr services.
- Default all deep replay dependencies to blocked. A later slice can enable a
  dependency deliberately with tests that prove it remains read-only and
  bounded.
- Surface execution context summaries in replay output. Operators and tests
  should be able to prove whether a response came from signal-fit replay or a
  deeper classifier replay.
- Add a replay item adapter before deterministic engine reuse. History rows and
  policy-engine items are different contracts; translating them in one ES module
  keeps replay scoring stable and testable.
- Prefer indexed scalar/array history columns before metadata JSON when both are
  available. Use JSONB only as bounded supplemental evidence.
- Keep row evidence and signal-fit evidence separate. A row can be valid enough
  to display while still lacking enough classification evidence for a useful
  replay decision.
- Add a policy-engine comparison adapter after replay item normalization. Native
  draft buckets and policy-engine signal configs are related but not identical
  contracts, so the translation belongs in one tested ES module.
- Reuse deterministic policy-engine signal scoring before full policy
  evaluation. Full evaluation pulls in policy lookup and optional RAG/profile/
  history paths, which remain outside representative replay until explicitly
  enabled.
- Treat strict/exclusion checks as evidence-aware blockers. Missing evidence
  should produce an `insufficient` preview, not a false block.
- Add a parity delta read model after policy-engine preview. Operators need the
  comparison translated into workflow language instead of interpreting multiple
  score buckets manually.
- Keep delta reason codes bounded and allow-listed. Reason codes may mention
  signal names and sanitized blocker labels, but must not expose raw metadata,
  prompts, traces, provider payloads, database IDs, or persistence details.
- Treat identity, strict-constraint, and exclusion drift as high impact because
  those buckets can change routing safety and review behavior.
- Keep preview routes side-effect free and validate the draft before any
  database reads that are not necessary for validation.
- Add sample-selection diagnostics before deeper replay dependencies. Operators
  should understand why a sample set exists or is empty before trusting any
  stronger replay output.
- Prefer aggregate diagnostics over raw diagnostic rows. Counts are enough to
  explain representative sample availability and avoid exposing sensitive
  classification metadata.
- Keep empty-sample reasons visible and stable through allow-listed status and
  reason-code enums so clients can render the state without parsing database
  details.
- Add per-sample evidence completeness after sample-selection diagnostics.
  Selection explains whether rows exist; completeness explains whether each row
  has enough stored evidence to support replay interpretation.
- Return field presence, not field values. Completeness should answer "what kind
  of evidence exists" without leaking ratings, keywords, overviews, metadata, or
  source identifiers.
- Reuse the replay item adapter as the only history-to-replay evidence boundary
  so scoring, policy-engine comparison, and completeness stay aligned.
- Add enrichment eligibility before enrichment execution. Operators need to see
  whether sparse samples have enough identity for a later safe enrichment path
  before any provider or metadata service is enabled in replay.
- Keep source categories abstract. Source names may explain route shape, but
  should not expose provider configuration, request inputs, API keys, IDs, or
  result payloads.
- Keep replay eligibility side-effect free. A preview endpoint must never call
  TMDB, OMDb, web search, AI, Arr, persistence, or queue services.
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
- Replay readiness and dry-run scoring remain limited to representative samples
  and deterministic signal fit. They do not yet prove full classifier parity.
- The sample query reads classification history, so empty or newly created
  libraries may report `no_samples` until history exists.
- The modal now has two preview actions. Copy and layout must keep their
  difference clear so operators do not confuse readiness with scoring results.
- Dry-run signal-fit replay is intentionally narrower than full classification
  replay. It can show native intent fit and hard blocks, but it does not yet
  compare profile, RAG, history, AI rerun, provider enrichment, or Arr routing
  outcomes.
- Stored history metadata quality controls dry-run usefulness. Samples with
  sparse metadata may report `insufficient` even when the full classifier could
  enrich and decide later.
- The execution context does not yet make full classification replay possible.
  It prevents accidental dependency use first, then later slices can opt into
  one read-only dependency at a time.
- Blocking RAG/profile/history reads is conservative. Some of those dependencies
  are read-only today, but they still involve deeper runtime behavior and should
  be enabled deliberately in replay-specific adapters.
- The replay item adapter does not enrich missing metadata. Sparse history rows
  stay sparse, which can make signal-fit replay conservative until an explicit
  read-only enrichment adapter is added.
- The adapter is not a persistence schema. Native intent storage and history
  schema changes remain out of scope until full replay parity is proven.
- Policy-engine preview comparison reuses preset signal scoring only. It does
  not yet include profile, RAG, history, pattern, candidate ranking, confidence
  caps beyond preset scoring, or final route decision behavior.
- Evidence-aware blockers are conservative. If history lacks the relevant field,
  replay will report insufficient evidence instead of guessing whether a strict
  constraint would block after enrichment.
- Parity delta is a workflow summary, not a classifier decision. It helps
  operators reason about draft impact, but it does not yet prove full runtime
  parity because deep dependencies remain disabled.
- Delta actions depend on representative history quality. Sparse samples can
  report insufficient even if a future full replay with enrichment would decide.
- Sample-selection diagnostics explain history availability only. They do not
  prove policy scoring parity or full classifier parity.
- Sparse-evidence counts are intentionally conservative and aggregate-level.
  They use indexed history fields plus metadata presence, not deep metadata
  inspection.
- The diagnostics query adds one more read to replay preview. It remains bounded
  and aggregate-only, but very large history tables still rely on existing
  classification-history indexing.
- Evidence completeness is not enrichment. A sparse sample stays sparse until a
  later read-only enrichment slice deliberately opts into an enrichment source.
- Field availability can explain replay uncertainty, but it does not guarantee a
  correct future classification because the full runtime still includes profile,
  RAG, history, AI, provider, and Arr behavior outside this preview.
- Hiding raw field values means operators see less detail than a database query,
  but it keeps the browser-facing contract safe and stable.
- Enrichment eligibility is not provider readiness. It does not prove TMDB,
  OMDb, or web-search providers are configured, online, under quota, or capable
  of returning useful data.
- Eligibility can produce false positives because identity may exist while a
  provider lacks the missing field. That is acceptable for a preview gate, but
  later enrichment execution must still return its own diagnostics.
- The preview intentionally hides identifiers. That makes troubleshooting less
  direct, but prevents replay preview from becoming an identifier disclosure
  surface.

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
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentReplayEnrichmentEligibility.test.mjs|policyIntentReplayEvidenceCompleteness.test.mjs|policyIntentReplaySampleDiagnostics.test.mjs|policyIntentReplayParityDelta.test.mjs|policyIntentReplayEngineComparison.test.mjs|policyIntentReplayItemAdapter.test.mjs|policyIntentReplayExecutionContext.test.mjs|policyIntentReplayScoring.test.mjs|policyIntentReplayPreview.test.mjs|policyIntentImpactPreview.test.mjs|policyIntentRequestValidator.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
cd client && node scripts/run-vitest.mjs run src/__tests__/api/policiesApi.test.js src/__tests__/api/barrelExports.test.js
```

Focused modal replay preview UX validation:

```bash
cd client && node scripts/run-vitest.mjs run src/__tests__/utils/policyIntentReplayPreview.test.js src/__tests__/composables/usePolicyIntentReplayPreview.test.js src/__tests__/PolicyIntentReplayPreviewCard.test.js src/__tests__/PolicyBuilderModal.test.js src/__tests__/api/policiesApi.test.js src/__tests__/api/barrelExports.test.js
```

## Completion Audit (2026-06-28)

Phase 5 is complete for the non-persistent server intent bridge:

- The server owns the generated `policy_intent_contract` schema and validation
  boundary.
- Detailed policy read/create/update responses include the server projection
  without expanding list responses.
- Create/update routes validate submitted native intent drafts before mutation
  and return bounded `policy_intent_write_preflight` diagnostics.
- The client submits the native draft as a compatibility sidecar while legacy
  preset/custom-signal storage remains authoritative.
- Impact preview compares legacy-compatible intent and native draft intent
  without persistence.
- Replay preview selects bounded representative samples and layers dry-run
  signal fit, policy-engine comparison, parity deltas, sample diagnostics,
  evidence completeness, and enrichment eligibility without executing AI,
  provider, Arr, classification, queue, or persistence side effects.

What remains is intentionally outside the Phase 5 checkpoint:

- Native intent database tables and conversion tooling.
- Making native intent the runtime classification authority.
- Replacing legacy preset/custom-signal storage as the write source of truth.
- Backup, restore, rollback, and post-upgrade conversion workflows for native
  intent records.
- Full classifier replay with opt-in read-only adapters for profile, RAG,
  history, AI, provider, and Arr behavior.

Those items belong to the planned Phase 8 storage migration path or later
runtime replay phases after parity and rollback safety are proven.

## Next Work

The next high-value follow-up after the Phase 5 checkpoint is a replay-safe
provider readiness projection. Enrichment eligibility now says which source
categories could help; the next useful question is whether those source
categories are currently configured and quota-safe without exposing API keys or
making live provider calls.
