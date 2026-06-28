# Policy Builder Phase 6 Implementation

Status: fourth component implemented
Scope: replay-safe enrichment adapter contract, TMDB dry-run adapter preview, quota-aware TMDB replay execution switch, and TMDB metadata coverage comparison

## Goal

Phase 6 proves that replay can reason about enrichment sources before any
provider-backed enrichment execution is enabled. Phase 5 answered whether
representative samples are sparse, whether enrichment could help, and whether
providers appear locally ready. Phase 6 starts the next boundary:

```text
Which replay enrichment adapters may run, and what is explicitly still blocked?
```

The first component intentionally did not call TMDB, OMDb, web search, AI,
Arr, queue, classification, or persistence services. It defined the contract
that later read-only adapters must pass through. The second component adds the
TMDB-specific adapter shape while keeping the default replay route blocked and
side-effect-free. The third component adds the first controlled execution
switch for a bounded TMDB metadata preview, but it still requires both server
and request opt-in before any live provider call can happen.
The fourth component adds a deterministic comparison layer that measures
whether the sanitized TMDB preview would make sparse representative evidence
more usable before any enrichment result is persisted.

## First Implemented Component

The first implemented component adds a blocked-by-default enrichment adapter
contract:

1. Add `server/src/services/policyIntentReplayEnrichmentAdapterContract.mjs`
   as the replay-only adapter contract boundary.
2. Define the first source categories:
   - `tmdb_metadata`
   - `omdb_rating`
   - `web_search_metadata`
3. Build adapter demand from existing enrichment eligibility output.
4. Build provider state from existing provider readiness output.
5. Return a browser-safe adapter contract under
   `sample.enrichment_adapter_contract` with:
   - source status,
   - adapter enabled state,
   - provider readiness state,
   - quota/cooldown/configuration booleans,
   - eligible sample count,
   - selected provider key,
   - bounded reason codes.
6. Keep every adapter blocked by default because live provider calls remain
   disabled for replay.
7. Normalize and display the contract in the replay preview card so operators
   can see that providers may be ready while replay adapters are still not
   enabled.
8. Do not expose API keys, provider configs, request URLs, queries, cache keys,
   raw provider payloads, raw provider errors, identifiers, traces, SQL, or
   persistence details.

This component is a contract checkpoint. It does not enrich data and does not
change classification behavior.

## Second Implemented Component

The second implemented component adds a replay-specific TMDB metadata adapter
preview:

1. Add `server/src/services/policyIntentReplayTmdbMetadataAdapter.mjs` as the
   TMDB-only replay adapter boundary.
2. Keep the adapter blocked by default through
   `createPolicyIntentReplayEnrichmentAdapterContext()`.
3. Select representative sample `tmdb_id` values only inside the server query
   path. The browser-facing replay sanitizer still removes identifiers.
4. Require both:
   - `enabledSources: ['tmdb_metadata']`
   - `liveProviderCallsEnabled: true`

   before the adapter can call its injected TMDB fetcher.
5. Keep the product route on the default blocked context, so no live TMDB call
   happens during normal replay preview.
6. Return only sanitized field availability:
   - status,
   - sample id,
   - available field names,
   - improved field names,
   - genre/keyword/studio counts,
   - bounded reason codes.
7. Suppress provider errors into reason codes and never expose raw provider
   errors.
8. Normalize and display the TMDB adapter preview in the replay preview card.

The adapter does not expose TMDB IDs, titles, overviews, provider URLs, request
URLs, raw TMDB payloads, keywords, studio names, API keys, cache keys, trace
IDs, SQL, or persistence details. It does not write caches, queues, history,
classification output, or Arr state.

## Third Implemented Component

The third implemented component adds a quota-aware TMDB replay execution
switch:

1. Add `server/src/services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs`
   as the live-read gate for TMDB metadata preview.
2. Add `server/src/services/policyIntentReplayTmdbProviderClient.mjs` as the
   adapter-facing client boundary over the existing TMDB service.
3. Keep default product replay blocked unless both conditions are true:
   - server env `POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENABLED=true`
   - request payload explicitly opts into `tmdb_metadata`
4. Require TMDB provider readiness to be:
   - configured,
   - ready,
   - quota-safe,
   - not in cooldown.
5. Build the enrichment adapter contract from the switch-owned execution
   context instead of enabling sources directly in the route.
6. Instantiate the TMDB provider fetcher only when the switch is enabled.
7. Sanitize the switch state into the TMDB adapter preview:
   - status,
   - request opt-in,
   - server opt-in,
   - provider-ready flag,
   - quota/cooldown flags,
   - selected provider key,
   - bounded reason codes.
8. Refuse execution inside the adapter if the adapter contract reports unsafe
   quota or cooldown state, even when a caller passes an enabled context.
9. Support the TMDB service's existing movie `releases` and TV
   `content_ratings` response shapes when computing sanitized certification
   field availability.
10. Display the switch state in the replay preview card without exposing
    provider request inputs, IDs, payload values, raw errors, or credentials.

This component still does not persist enriched metadata, mutate caches, enqueue
tasks, rerun classification, call AI, or write to Arr. It is a bounded
operator/debug preview path only.

## Fourth Implemented Component

The fourth implemented component adds TMDB metadata coverage comparison:

1. Add
   `server/src/services/policyIntentReplayTmdbMetadataCoverageComparison.mjs`
   as a pure deterministic reducer over existing replay evidence completeness
   and sanitized TMDB adapter preview output.
2. Compare each sample's current field availability with the fields the TMDB
   preview says it could add.
3. Report only field names and aggregate counts:
   - comparison status,
   - comparable sample count,
   - improved sample count,
   - completeness upgrade count,
   - added field count,
   - remaining missing field count,
   - before/after strong evidence counts,
   - bounded per-sample field lists and reason codes.
4. Keep provider values out of the contract. The comparison does not expose
   titles, IDs, ratings, genres, keywords, studios, overviews, payloads, request
   URLs, errors, credentials, cache keys, SQL, traces, or draft bodies.
5. Normalize and render the comparison in the replay card:
   - summary chip,
   - comparison panel,
   - per-sample "adds field names" line.
6. Preserve all replay safety properties: no provider calls, AI calls,
   persistence, cache mutation, queue mutation, classification reruns, or Arr
   writes are added by the comparison layer.

This component answers whether TMDB preview data appears valuable enough to
matter, without making TMDB data authoritative and without changing runtime
classification behavior.

## Research Inputs

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html):
  API contracts should be explicit and machine-readable instead of inferred
  from implementation details. Phase 6 adds a versioned replay adapter contract
  before any adapter execution exists.
- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/):
  APIs should expose only properties the caller should read. The adapter
  contract exposes readiness booleans, counts, provider keys, and reason codes,
  not provider credentials, configs, request inputs, raw payloads, or IDs.
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  APIs should bound per-request work and third-party resource use. The first
  Phase 6 slice performs no live calls and reuses existing replay eligibility
  and readiness outputs.
- [OWASP API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/):
  Privileged operations should sit behind explicit function boundaries. Replay
  enrichment gets its own adapter contract so a preview route cannot
  accidentally become an enrichment execution path.
- [OWASP API8:2023 Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/):
  APIs should not expose unnecessary implementation or configuration details.
  Phase 6 keeps provider configuration and raw execution details out of the
  browser-facing replay contract.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework):
  AI-adjacent systems need governance, traceability, and measurable controls.
  The adapter contract gives replay a measurable control boundary before local
  LLM, provider, or classifier dependencies are enabled. The coverage
  comparison adds an explicit measurement layer before any enriched evidence is
  allowed to influence classification.
- [TMDB Movie Details API](https://developer.themoviedb.org/reference/movie-details):
  TMDB supports bounded movie detail retrieval and `append_to_response`, which
  allows Phase 6 to define a single constrained metadata request shape instead
  of multiple unbounded follow-up calls.
- [TMDB Authentication](https://developer.themoviedb.org/docs/authentication-application):
  TMDB API access depends on configured credentials, so replay must keep
  provider execution behind server-side readiness and adapter authorization.
- [TMDB Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting):
  TMDB documents that clients should respect `429` responses and avoid
  excessive request pressure. The replay adapter therefore caps preview items
  and the live-preview switch requires explicit server and request opt-in plus
  quota/cooldown readiness before execution.

## Recommendation Stack

- Keep adapter availability separate from provider readiness. A provider can be
  configured and quota-safe while replay still blocks the corresponding
  enrichment adapter.
- Default every replay enrichment adapter to blocked.
- Require explicit source allow-listing and live-provider capability before an
  adapter may execute.
- Surface the blocked state in the UI so operators understand this is a
  deliberate replay boundary, not a missing provider configuration.
- Reuse existing enrichment eligibility and provider readiness projections
  instead of adding more database reads in this slice.
- Keep the browser contract bounded to booleans, counts, source names,
  selected provider keys, and reason codes.
- Use a TMDB-specific adapter service instead of embedding provider logic in
  the route or generic replay preview builder.
- Inject provider fetch behavior into the adapter so tests can prove sanitized
  behavior without secrets or network calls.
- Cap TMDB preview work to a small representative slice.
- Return before/after field availability rather than provider values.
- Measure field-coverage deltas before promoting preview-only enrichment into
  any persistence or classification path.
- Prefer deterministic reducers over provider or AI calls for comparison
  output.
- Require a two-key live-preview gate: server environment allow-list and
  request opt-in.
- Instantiate provider clients only after the execution switch is enabled.
- Keep quota and cooldown checks in both the switch and adapter, so route
  wiring mistakes fail closed.
- Do not add provider calls, AI calls, queue writes, history mutation, cache
  mutation, Arr writes, or persistence until a later adapter-specific component
  explicitly opts in.

Pros:

- Creates the execution boundary needed before TMDB/OMDb/web-search replay
  enrichment is implemented.
- Makes provider readiness versus adapter enablement clear to operators.
- Keeps Phase 6 testable without external services or secrets.
- Preserves Phase 5's no-side-effect replay guarantee.
- Lets tests exercise the opt-in path with fixture payloads while production
  replay remains blocked.
- Gives operators a visible TMDB dry-run adapter state without leaking item or
  provider identity.
- Allows controlled local/test validation of TMDB metadata field coverage
  without enabling broad replay enrichment execution.
- Keeps the standard preview button no-call by default.
- Makes the value of TMDB metadata preview visible before changing runtime
  behavior.
- Gives operators per-sample "what would become usable" output without raw
  provider data.

Cons:

- The contract does not improve sparse samples yet.
- Providers may show ready while adapters remain blocked, which adds one more
  replay state operators need to understand.
- The first contract is conservative and may need more per-source capability
  metadata when the first live read-only adapter is added.
- The live-preview path still needs explicit non-default configuration, so most
  operators will continue to see a blocked switch until they opt in.
- This is preview-only; it does not yet repair sparse metadata or feed
  classification.
- Route payload opt-in is intentionally not exposed as a primary UI workflow
  until the preview semantics are proven stable.
- The comparison can only be as useful as the sanitized TMDB adapter preview;
  blocked or unavailable adapter states produce no field gains.

## Validation

Focused adapter contract validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentReplayTmdbMetadataCoverageComparison.test.mjs|policyIntentReplayTmdbMetadataAdapter.test.mjs|policyIntentReplayEnrichmentAdapterContract.test.mjs|policyIntentReplayProviderReadiness.test.mjs|policyIntentReplayPreview.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
cd client && node scripts/run-vitest.mjs run src/__tests__/utils/policyIntentReplayPreview.test.js src/__tests__/PolicyIntentReplayPreviewCard.test.js
```

## Next Work

The next high-value component is an operator-facing replay enrichment opt-in
control. It should expose the TMDB live-preview switch as an advanced,
clearly-labeled action that remains disabled unless server opt-in and provider
readiness are both present. The control should make the two-key gate explicit
and avoid hidden request-payload flags, while preserving the default no-provider
preview path.
