# Policy Builder Phase 6 Implementation

Status: second component implemented
Scope: replay-safe enrichment adapter contract and TMDB dry-run adapter preview

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
side-effect-free.

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
  LLM, provider, or classifier dependencies are enabled.
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
  and remains blocked by default until a later component adds quota-aware live
  execution.

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

Cons:

- The contract does not improve sparse samples yet.
- Providers may show ready while adapters remain blocked, which adds one more
  replay state operators need to understand.
- The first contract is conservative and may need more per-source capability
  metadata when the first live read-only adapter is added.
- The TMDB adapter still needs a quota-aware live execution component before it
  can enrich real replay samples.
- The current product route shows the TMDB adapter state but does not execute
  it.

## Validation

Focused adapter contract validation:

```bash
cd server && node ./scripts/run-jest.mjs --runInBand --testPathPatterns="policyIntentReplayTmdbMetadataAdapter.test.mjs|policyIntentReplayEnrichmentAdapterContract.test.mjs|policyIntentReplayProviderReadiness.test.mjs|policyIntentReplayPreview.test.mjs|policies-routes.coverage.test.mjs" --no-coverage
cd client && node scripts/run-vitest.mjs run src/__tests__/utils/policyIntentReplayPreview.test.js src/__tests__/PolicyIntentReplayPreviewCard.test.js
```

## Next Work

The next high-value component is a quota-aware TMDB replay execution switch for
local development and test-only preview paths. It should keep the default route
blocked, but add an explicit server-side execution context that can enable
`tmdb_metadata` for a small bounded sample slice, pass through TMDB provider
readiness/cooldown state, and convert live `429` or provider errors into
sanitized adapter statuses without cache mutation, persistence, classifier
reruns, AI calls, Arr writes, raw payloads, or identifier exposure.
