# Embedding vector validation outcome

Date: 2026-09-07. See the separate
[design, sources and alternatives](embedding-vector-validation-design.md).

## Implemented behavior

All 13 text/image embedding adapter paths and Ollama embedding warmup use the
shared ESM validator. Invalid vectors cannot produce a success result, cost-success
record, provider success metric or warmup success. Storage validates vector/dims
again before SQL. Dimension mismatch no longer triggers truncation, column/index
replacement or a rebuild job. Existing data and database constraints are retained.

The expanded compatibility fixture now uses 16,000 dimensions to respect pgvector
storage. The earlier 16,384-value fixture tested byte transport only; its historical
measurements remain in the earlier outcome. A well-formed numeric vector is not
evidence of correct media identity, matching model space or classification quality.

## Validation

The focused provider/validation/storage tests exercise actual loopback HTTP for
all adapters, including missing, empty, numeric-string, null, zero-norm,
float32-overflow and over-dimension responses. Same-provider cost writes and
immediate retry callbacks must remain untouched on rejection. The provider-level
test additionally verifies no circuit success or successful-request increment.

The real PostgreSQL integration checks passed together with identity-retention
regressions: **25 tests across two suites**. The new fixture verifies valid text
and image writes, both database dimension mismatch paths, invalid metadata before
SQL, no repair transaction and unchanged rows, dimensions and indexes. All fixture
tables are temporary and the outer transaction rolls back.

The full backend suite passed **31,766 tests across 1,105 suites** in 117.48
seconds. After adding the media-sync warning integration assertion and final
type/import cleanup, the focused run passed **368 tests across nine suites**.
Backend typechecking, scoped ESLint, production dependency checks, ESM static
import/mock-shape checks and documentation lint all passed. Documentation lint
checked 1,091 Markdown files. Frontend compilation and runtime checks follow in
the no-cache Compose build; no client API contract changed.

## PR availability and next work

GitHub MCP returned an empty open-PR collection. No PR could be randomly selected;
no closed PR was substituted and no original PR was merged.

The additional [media-sync investigation](media-sync-identity-warning-outcome.md)
identified conflicting provider IDs. The next inventory improvement is to retain
those rejected source observations separately, with explicit conflict status and
no resolved identity/routing authority. This preserves visibility of what exists
and where without requiring routine manual cleanup. Separately, add model-space
and schema compatibility preflight before allowing model transitions or fallback
vectors to mix. No release or tag is created by this work.
