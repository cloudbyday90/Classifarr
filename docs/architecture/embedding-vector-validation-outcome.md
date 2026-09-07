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
checked 1,091 Markdown files. No client API contract changed.

## Rebuilt Compose verification

A 44,508,770-byte database archive was copied to ignored local storage,
checksum-verified and inspected with pg_restore before recreation. The previous
image is retained locally. The no-cache build passed from clean source revision
`03656f6575627d5f44592641781e5a31e4bdc1ec`; the recreated container is healthy
and reports that revision. Both dependency installs reported zero audit
vulnerabilities; frontend compilation passed in 5.29 seconds. npm reported
blocked Scarf and bcrypt install scripts. The runtime bcrypt hash/compare check
passed; no install-script permissions were broadened.

The in-container semantic fixture passed **133 checks across 72 embedding HTTP
requests**, covering ten direct adapters and warmup without real provider calls
or persistent database writes. The three shared adapter paths are covered by the
unit HTTP suite, where cost persistence is mocked. The byte-budget/cancellation
fixture passed another **34 assertions across 17 local HTTP requests** with the
updated 16,000-value compatibility vector. The committed PostgreSQL fixture also
passed against the rebuilt container using temporary tables and final rollback:
two valid writes, two rejected dimension writes, two rejected malformed writes,
and unchanged rows, dimensions and indexes after rejection.

All ten authenticated inventory/statistics/settings requests returned 200; six
anonymous requests returned 401 and unsupported health/overlap parameters returned
400. Masked settings matched the selected runtime configuration. Observation
health and overlap remained available with no-store, 6,692 inventory rows and ten
libraries, at sample times of 552 ms and 572 ms. History remained at 6,775 records,
with zero feedback records and 250 migrations; provider integrity had zero invalid
providers. The startup/smoke sample contained 312 informational records, five
slow-query warnings and zero error/fatal or provider-drift records. Background
work remained enabled; fixture side-effect assertions apply to the fixtures only.

Private source observations, credentials, logs and backups are not committed.
Only final outcome documentation differs from the tested image source.

## PR availability and next work

GitHub MCP returned an empty open-PR collection at start and final readback.
No PR could be randomly selected;
no closed PR was substituted and no original PR was merged.

The additional [media-sync investigation](media-sync-identity-warning-outcome.md)
identified conflicting provider IDs. The next inventory improvement is to retain
those rejected source observations separately, with explicit conflict status and
no resolved identity/routing authority. This preserves visibility of what exists
and where without requiring routine manual cleanup. Separately, add model-space
and schema compatibility preflight before allowing model transitions or fallback
vectors to mix. No release or tag is created by this work.
