# Web Search Provider Error Taxonomy

Status: implemented for the current development line.

## Purpose

Define one provider-neutral error taxonomy for web-search adapters before Classifarr adds provider storage, quota-aware routing, cooldowns, Brave, or Serper.dev.

The taxonomy turns provider-specific HTTP/network failures into stable, sanitized fields that future routing and usage storage can trust.

## Research Notes: June 2026

Official sources reviewed:

- RFC 9110 defines HTTP status-code classes and states that `4xx` means the request contains bad syntax or cannot be fulfilled, while `5xx` means the server failed to fulfill an apparently valid request.
- RFC 6585 defines `429 Too Many Requests` for rate limiting and allows a `Retry-After` header to indicate how long to wait before retrying.
- Tavily rate-limit documentation says exceeded limits return `429 Too Many Requests` with `retry-after` seconds and recommends respecting that header.
- Brave Web Search API documents explicit error responses for `404`, `422`, and `429`.
- OWASP API4:2023 recommends rate limiting, throttling, server-side validation of response-size controls, and spending limits for API integrations.
- Node.js documents network/TLS error codes such as `ECONNRESET`, `ENOTFOUND`, and `ETIMEDOUT`, which should be treated separately from provider HTTP responses.

Source URLs:

- https://datatracker.ietf.org/doc/html/rfc9110
- https://datatracker.ietf.org/doc/html/rfc6585
- https://docs.tavily.com/documentation/rate-limits
- https://api-dashboard.search.brave.com/api-reference/web/search/get
- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- https://nodejs.org/api/errors.html

## Recommendation

Use a small ES Module taxonomy layer that maps raw provider errors into sanitized `WebSearchProviderError` instances.

The error shape should include:

- `code`: stable Classifarr category.
- `provider`: provider key.
- `operation`: `search`, `test_connection`, or future operation names.
- `httpStatus`: provider HTTP status when available.
- `retryable`: whether retrying can reasonably succeed later.
- `cooldownEligible`: whether provider routing should consider temporary cooldown.
- `retryAfterSeconds`: parsed `Retry-After` value when present.
- `causeCode`: Node/network cause code when available.
- safe message: bounded and credential-redacted.

## Error Codes

Initial categories:

- `auth_failed`
- `forbidden`
- `rate_limited`
- `quota_exhausted`
- `invalid_request`
- `not_found`
- `provider_response_invalid`
- `provider_5xx`
- `timeout`
- `network_error`
- `ssl_error`
- `unknown`

## Pros

- Keeps provider routing independent from Tavily/Brave/Serper response quirks.
- Preserves `Retry-After` so cooldowns can honor provider guidance.
- Separates transient failures from permanent configuration/request failures.
- Provides storage-ready fields for future usage and status tables.
- Avoids logging or returning raw provider payloads as primary error state.

## Cons

- Some providers use `429` for both burst rate limits and exhausted quota, so message-based quota detection is still a heuristic.
- This does not implement retries or cooldown storage by itself.
- Provider-specific adapters may later need override hooks for unusual error payloads.

## Final Stack

```text
provider call failure
  -> classifyWebSearchProviderError(...)
  -> WebSearchProviderError
  -> future usage record / cooldown decision / trace event
```

## Implemented Outcome

Added:

- `server/src/services/webSearchProviderErrorTaxonomy.mjs`
- `server/src/__tests__/services/webSearchProviderErrorTaxonomy.test.mjs`

Updated:

- `server/src/services/tavilyWebSearchProvider.mjs`
- `server/src/services/tavily.mjs`

The Tavily provider wrapper now converts provider-call and normalized-response failures into `WebSearchProviderError` while preserving current production Tavily service behavior.

## Security Boundaries

- Provider messages are bounded and control-character cleaned.
- Obvious credential labels such as API key/token/authorization fields are redacted.
- Raw provider payloads remain on the original cause only; normalized error fields are safe for future traces and storage.
- `Retry-After` is capped to one day to avoid unbounded cooldown input.
- HTTP status, provider key, operation, and Node cause code are scalar fields suitable for logs and database rows.

## Verification

Targeted commands:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderErrorTaxonomy|services/webSearchProviderContract|services/webSearchResultNormalizer|tavily" --runInBand --no-coverage
node ./scripts/run-jest.mjs --testPathPatterns="codeHealth" --runInBand --no-coverage
```

Repository-level:

```bash
npm run check-copyright
git diff --check
```

## Remaining Work

Next slices:

1. Provider config and usage storage.
2. Quota-aware provider orchestration.
3. Brave and Serper adapters with provider-specific error fixtures.
4. Web-search evidence/error trace UI.
5. Provider reliability calibration.
