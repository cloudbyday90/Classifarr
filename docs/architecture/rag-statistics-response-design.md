# RAG statistics response design

Reviewed: 2026-10-06.

## Cause and decision

`getRagDetailed` follows the client API contract: GET helpers return the unwrapped
response body. `RAGStats.vue` validates `response.stats` but then reads
`response.data.stats`. A successful request therefore throws the error shown in
the report. This is separate from backend comparison-memory admission.

Consume the named API function's body consistently. Keep POST responses wrapped,
preserve existing metric fallbacks, polling and retry behavior, and reject missing
statistics instead of silently presenting a healthy zero-data dashboard. Add
tests mounting the actual RAG view with its real SWR fetch path: the parent
Statistics test replaces this child and cannot detect this regression.

## Alternatives

- **Fix the consumer (recommended):** small, consistent with every GET endpoint;
  regression tests cover the previously missed integration boundary.
- Wrap this endpoint again: would create an exception to the central API contract
  and risk breaking other consumers.
- Default every missing field to zero: hides response failures; not acceptable.

No server contract, database, credentials, recovery or provider action changes.
Existing semantic buttons and polling visibility rules remain unchanged.
