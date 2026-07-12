# Policy Replay Enrichment Retirement

## Status

Implemented July 11, 2026 as a Phase 6R.1 migration-verifier cutline component.

## Intent

The replay migration verifier previously loaded TMDB and OMDb configuration,
queried web-search provider route candidates and usage state, surfaced quota and
cooldown state, selected provider keys, and could make a live TMDB request when
both an environment flag and request input allowed it. No normal product flow
used this information after the browser diagnostic UI was removed.

This made a migration-only endpoint another provider decision path. It
duplicated the dedicated metadata and web-search provider contracts while
contradicting the evidence engine's offline, source-authorized model.

## Official Guidance Reviewed

- [OWASP API4:2023, Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends limiting externally charged or resource-intensive operations.
  Removing optional live provider calls eliminates an unnecessary request path.
- [OWASP API10:2023, Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
  requires validation, sanitization, limits, and timeouts around third-party
  integration. A migration verifier should not fetch third-party data when its
  durable evidence source is persisted local state.
- [TMDB rate-limiting guidance](https://developer.themoviedb.org/docs/rate-limiting)
  states that upper limits can change and clients must respect `429` responses.
  The metadata integration owns that behavior; a migration verifier does not
  need a parallel call path.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports minimizing and verifying the code paths that can affect security and
  operational risk.

## Options Considered

1. **Keep the provider-readiness and TMDB preview stack.**
   It offers diagnostics, but creates a duplicate policy-adjacent provider path
   with quota and configuration semantics.
2. **Rewrite it around the provider router.**
   The router already owns provider selection and quota-aware behavior; exposing
   it from migration verification would still not establish policy evidence.
3. **Delete the enrichment stack and retain provider-free verification.**
   Keep bounded history samples, sample selection diagnostics, and local
   completeness only. Provider behavior remains in its dedicated contracts.

## Final Recommendation Stack

1. Delete replay provider readiness, enrichment eligibility, adapter contract,
   TMDB execution switch, provider client, adapter, and coverage comparison.
2. Remove provider, quota, cooldown, selected-provider, and TMDB-preview fields
   from the verifier response and execution path.
3. Keep the verifier administrator-protected, bounded, parameterized, and
   provider-free while its independent migration retention gate remains active.
4. Keep historical deletion records for removed services and tests.
5. Use dedicated metadata and web-search provider contracts whenever actual
   provider behavior is required.

## Implementation Outcome

- Deleted the seven provider/TMDB replay enrichment services and their focused
  ESM tests.
- Removed the TMDB service dependency from the migration-verifier route.
- Reduced replay verification to three local database reads: preset lookup,
  representative history samples, and sample-selection diagnostics.
- Removed provider readiness, quota/cooldown, selected-provider, enrichment,
  adapter, and TMDB-preview response sections.
- Reclassified all retired enrichment services as `delete_after_migration` in
  the migration-deletion inventory.

## Security Outcome

- Migration verification cannot make a live TMDB request, even when an
  environment flag or request field is present.
- It cannot expose provider configuration, selected provider keys, quota state,
  cooldown state, or provider route candidates.
- The retained sample read remains bounded and parameterized.
- Provider quota and routing are now owned only by their dedicated provider
  contracts, rather than duplicated by a migration endpoint.

## Verification

- Focused route coverage proves exactly three database reads and verifies that
  all retired provider/enrichment fields are absent.
- Focused verifier coverage proves the remaining response is provider-free.
- Migration inventory tests prove there is no active enrichment-coverage
  migration verifier.
- Full client/server, lint, documentation, and naming checks are required
  before release.

## Next Step

Evaluate the remaining provider-free replay sample diagnostics and completeness
reducers. Retain them only if their bounded local summaries provide independent
migration value; otherwise remove the replay migration endpoint rather than
maintaining a hollow verifier.
