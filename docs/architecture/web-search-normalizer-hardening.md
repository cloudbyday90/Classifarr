# Web Search Normalizer Hardening

Status: implemented for the current development line.

## Purpose

Harden the provider-neutral web-search normalization boundary before adding Brave, Serper.dev, provider routing, or quota-aware fallback.

The normalizer is the point where untrusted third-party search responses become Classifarr evidence. That makes it the right place to enforce resource bounds, URL safety, text cleanup, and stable field shapes once for every provider.

## Research Notes: June 2026

Official sources reviewed:

- Tavily Search API documents `results[]`, `answer`, `usage`, `request_id`, search-depth credit differences, and `max_results` with required range `0 <= x <= 20`.
- Tavily rate-limit docs identify API-key-based rate limits and HTTP `429` / `retry-after` behavior.
- Brave Web Search API documents web result payloads and a `count` parameter capped at 20.
- Brave pricing/capacity docs separate Search API, AI Grounding, and Data for AI usage, which means cost units should stay provider-specific.
- Serper.dev exposes Google-style SERP payloads, including `organic` result shapes.
- OWASP API4:2023 recommends maximum sizes for strings, arrays, and payloads to reduce unrestricted resource consumption.
- OWASP XSS guidance treats third-party/user content as untrusted and recommends validation, encoding, and sanitization before unsafe sinks.
- MDN, WHATWG, and Node.js docs all point to the WHATWG `URL` API for parsing/canonicalizing URLs and handling invalid URL inputs.

Source URLs:

- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/rate-limits
- https://api-dashboard.search.brave.com/api-reference/web/search/get
- https://api-dashboard.search.brave.com/documentation/pricing
- https://serper.dev/
- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
- https://url.spec.whatwg.org/
- https://nodejs.org/api/url.html

## Recommendation

Implement normalizer hardening before adding new providers.

The normalizer should:

- Treat provider response text as untrusted input.
- Remove script/style blocks, HTML tags, control characters, and zero-width characters.
- Decode common HTML entities before prompt formatting.
- Bound title, snippet, answer, query, and result counts.
- Use WHATWG `URL` parsing and only accept HTTP/HTTPS result URLs.
- Extract stable source domains.
- Normalize ranks, scores, and dates into predictable shapes.
- Emit aggregate warning codes for dropped or normalized fields.
- Support known provider response shapes:
  - Tavily: `results[]`
  - Serper: `organic[]`
  - Brave: `web.results[]`

## Pros

- Prevents every future adapter from reimplementing the same safety logic.
- Reduces prompt and UI evidence noise before classification sees provider text.
- Makes provider evidence comparable by forcing one normalized result shape.
- Provides warning metadata for future trace/UI observability.
- Keeps existing Tavily search behavior stable while improving output hygiene.

## Cons

- This does not replace final output encoding in the UI.
- This does not solve prompt injection by itself; it only reduces malformed/HTML/script noise.
- Relative or non-HTTP URLs are dropped, which is correct for web-search evidence but could hide provider bugs.
- Date normalization intentionally drops relative dates like "2 days ago" until a provider-specific date parser exists.

## Final Stack

```text
webSearchResultNormalizer
  -> sanitize text
  -> canonicalize URL/domain
  -> clamp count/rank/score/date fields
  -> emit warning metadata
  -> format prompt-safe evidence
```

The service stays modular and ES Module-only. Provider adapters should call this layer instead of formatting provider output directly.

## Implemented Outcome

Added or hardened:

- `decodeBasicHtmlEntities(...)`
- `sanitizeWebSearchText(...)`
- `truncateWebSearchText(...)`
- `normalizeWebSearchUrl(...)`
- `normalizeWebSearchRank(...)`
- `normalizeWebSearchScore(...)`
- `normalizeWebSearchPublishedAt(...)`
- `normalizeWebSearchResults(...)`
- `formatNormalizedWebSearchForAI(...)`
- `formatWebSearchResponseForAI(...)`

Behavior now enforced:

- Result count clamped to `1..20`.
- Provider keys normalized to trace-safe tokens.
- `javascript:`, `file:`, malformed, and empty URLs dropped.
- Script/style blocks removed before tag stripping.
- HTML tags and common entities cleaned from titles, snippets, and answers.
- Control and zero-width characters removed.
- Scores normalized to `0..1` when provider returns either decimal or percent-like values.
- Invalid ranks, scores, dates, URLs, empty rows, and non-object rows emit warning codes.
- Tavily, Serper, and Brave result containers normalize through one path.

## Verification

Targeted tests cover:

- result-count clamps
- provider-key normalization
- URL parsing and unsafe URL rejection
- HTML/entity/control-character cleanup
- rank, score, and date normalization
- Tavily-style `results[]`
- Serper-style `organic[]`
- Brave-style `web.results[]`
- prompt formatting without HTML tags
- empty-result fallback

Commands:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchResultNormalizer|tavily|classificationAiService" --runInBand --no-coverage
node ./scripts/run-jest.mjs --testPathPatterns="codeHealth" --runInBand --no-coverage
```

Repository-level:

```bash
npm run check-copyright
git diff --check
```

## Remaining Work

Next slices:

1. Add explicit provider contract validation.
2. Add provider config and usage storage.
3. Add quota-aware routing and cooldown decisions.
4. Add Brave and Serper adapters behind the normalized contract.
5. Surface web-search evidence warnings in decision traces.
