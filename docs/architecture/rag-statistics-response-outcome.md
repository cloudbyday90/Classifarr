# RAG statistics response outcome

Date: 2026-10-06.

Fixed the [response-contract mismatch](rag-statistics-response-design.md) in the
RAG & Embeddings view. All GET result fields now come from the unwrapped body;
mutation handlers retain their existing Axios response contract.

The real view and SWR path now have regression tests for populated statistics,
provider cooldown, circuit-breaker state, backfill history, missing optional
fields, legacy failed-count fallback, malformed responses and Retry recovery.
Missing statistics remain an explicit error, not a success with zero counts.

Focused validation: three client suites / 20 tests passed (RAG view, API leaf
and parent Statistics view). The new view coverage is nine tests. Full-suite
and candidate-image results are recorded with the
[memory change outcome](comparison-fingerprint-allocation-outcome.md).

No API endpoint, database migration, provider action or access-control change.
This fixes the supplied browser error; it does not alter backend memory-pressure
handling. No release was created.
