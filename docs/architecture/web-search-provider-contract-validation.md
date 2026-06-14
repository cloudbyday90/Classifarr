# Web Search Provider Contract Validation

Status: implemented for the current development line.

## Purpose

Add a runtime contract for web-search provider adapters before Classifarr adds Brave, Serper.dev, provider storage, or quota-aware routing.

The contract defines the minimum provider shape, request shape, and normalized response shape that future orchestration code can trust. It deliberately does not add routing, persistence, or new UI behavior.

## Research Notes: June 2026

Official sources reviewed:

- OWASP Input Validation guidance recommends allowlist validation and exact matching for fixed option sets, with normalization for free-form text.
- OWASP API4:2023 identifies missing limits on execution time, record counts, operation counts, payload size, and third-party spending as unrestricted-resource-consumption risks.
- JSON Schema validation defines structural validation as assertions about what a valid document must look like, including type, enum, numeric, string, and object constraints.
- Zod 4 documents runtime schema validation for untrusted data and `safeParse(...)` for non-throwing validation results.
- Node.js documents ECMAScript modules as the official JavaScript module format, with explicit `.mjs` and `type: "module"` support.

Source URLs:

- https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- https://json-schema.org/draft/2020-12/json-schema-validation
- https://zod.dev/
- https://zod.dev/basics
- https://nodejs.org/api/esm.html

## Recommendation

Use a small ES Module contract validator backed by Zod schemas and a sanitized custom error type.

The validator should enforce:

- Provider keys as trace-safe tokens.
- Adapter display names with bounded length.
- Known capability booleans.
- Required `testConnection(...)` and `search(...)` functions.
- Search purposes from a fixed allowlist.
- Query, domain, trace, and result-count bounds.
- Normalized response shapes only, not raw provider payloads.
- Sanitized validation errors that report path/code/message without echoing secrets or raw payloads.

## Pros

- Prevents adapter drift before multiple providers exist.
- Gives the future orchestrator one trusted request/response boundary.
- Catches unsafe or raw provider payloads before routing and decision traces consume them.
- Reuses the existing `zod` dependency instead of adding a new validator.
- Keeps provider wrappers modular and ES Module-only.

## Cons

- Runtime validation adds a small amount of code at provider boundaries.
- This does not validate provider credentials; that remains provider-specific.
- This does not implement quota-aware fallback or provider storage.
- Strict provider shape means adapter-specific clients must stay private to the module, not attached to the exported provider object.

## Final Stack

```text
provider adapter
  -> validateWebSearchProvider(...)
  -> validateWebSearchRequest(...)
  -> provider API call
  -> normalizeWebSearchResults(...)
  -> validateWebSearchResponse(...)
  -> future orchestrator
```

## Implemented Outcome

Added:

- `server/src/services/webSearchProviderContract.mjs`
- `server/src/services/tavilyWebSearchProvider.mjs`
- `server/src/__tests__/services/webSearchProviderContract.test.mjs`

The contract module exports:

- `WEB_SEARCH_PROVIDER_CONTRACT_VERSION`
- `WEB_SEARCH_PURPOSES`
- `WEB_SEARCH_CAPABILITY_KEYS`
- `WebSearchProviderContractError`
- `validateWebSearchProvider(...)`
- `validateWebSearchRequest(...)`
- `validateWebSearchResponse(...)`
- `isValidWebSearchProvider(...)`
- `assertWebSearchProvider(...)`

The Tavily wrapper is contract-compatible but is not yet wired into production routing. That keeps the current Tavily behavior stable while giving the next orchestration slice a real provider adapter to call.

## Security Boundaries

- Provider validation uses allowlisted provider keys and purpose values.
- Request validation bounds result counts to `1..20`, matching the shared Tavily/Brave maximum used by the normalizer.
- Domain filters must be hostnames, not URLs.
- Trace IDs are bounded trace-safe strings.
- Response validation accepts only normalized results with HTTP/HTTPS URLs already enforced by the normalizer.
- Validation errors expose only issue path, issue code, and message.

## Verification

Targeted commands:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderContract|services/webSearchResultNormalizer|tavily" --runInBand --no-coverage
node ./scripts/run-jest.mjs --testPathPatterns="codeHealth" --runInBand --no-coverage
```

Repository-level:

```bash
npm run check-copyright
git diff --check
```

## Remaining Work

Next slices:

1. Provider error taxonomy.
2. Provider config and usage storage.
3. Quota-aware provider orchestration.
4. Brave and Serper adapters.
5. Web-search evidence trace UI.
