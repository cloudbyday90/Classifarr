# Embedding vector validation design

Date: 2026-09-07. Follow-up to the
[response budget outcome](embedding-response-budgets-outcome.md).

## Problem and decision

Byte limits protect transport memory but do not establish that a returned vector
can be used. Text and image adapters previously accepted missing/empty vectors;
the local image adapter trusted reported dimensions. Same-provider cloud mode
could record cost before discovering an invalid vector. A later dimension error
could truncate all text/image records or drop the image column and its indexes.

Use a small, pure ESM validator at every embedding adapter, including shared cloud,
shared/direct Ollama and embedding warmup. Require exactly one vector in batch
envelopes for these single-input requests. Require a dense numeric array with
1–16,000 finite, float32-representable components and nonzero norm. Reject values
that overflow or round to zero in float32, without coercing, truncating or
normalizing the array. Optional sidecar dimensions must be an integer equal to
the vector length; internal results must carry that integer explicitly.

Validation runs before cost-success persistence, provider success metrics and
warmup success. INVALID_EMBEDDING has a fixed message and no response body or
cause. Immediate retries preserve and do not retry it. Existing outer fallback
and background retry policies continue to apply; their embedding paths validate
too. Actual provider billing can still occur for a rejected response; local cost
success records are not a provider billing ledger.

Validate again before text/image SQL. Remove all schema-changing recovery from
ordinary embedding writes. PostgreSQL remains authoritative for column dimensions;
an incompatible write fails without a retry, truncation, column/index drop, audit
success or queued rebuild. Text failures propagate; image storage retains its
existing null failure result. Schema changes require a separately designed,
explicit migration/rebuild workflow. No schema migration is part of this fix.

## Official sources and application

Research was checked on September 7, 2026, using search/open tools. Living documents
are not claimed to represent the remainder of September.

- [pgvector reference](https://github.com/pgvector/pgvector): vector storage uses
  finite single-precision components and permits up to 16,000 dimensions. Cosine
  indexes omit zero vectors. These constraints motivate the numeric and nonzero
  validation; the 16,000 storage ceiling is distinct from lower index limits.
- [OWASP API10](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/):
  validate third-party data. Here external vector metadata must never authorize
  destructive database changes. Existing TLS, bounded responses and cancellation
  remain in place.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/): document
  provenance and data quality/fitness for use. Here numeric validity is explicitly
  distinguished from identity, model compatibility and classification accuracy.
  This backend change introduces no UI and makes no new WCAG conformance claim.
- [PostgreSQL SAVEPOINT](https://www.postgresql.org/docs/15/sql-savepoint.html):
  restore transaction state after a rejected statement. The regression fixture
  uses temporary tables, savepoints and final rollback to verify preservation.

## Alternatives and recommendation stack

| Option | Advantages | Costs or limitations |
| --- | --- | --- |
| Shared validation plus fixed-schema writes — selected | Uniform behavior, protects existing records, no operator settings | Some formerly accepted custom responses now fail; schema/model changes need explicit handling |
| Database-only validation | Database enforces its own types | Too late for success accounting; empty or malformed responses fail inconsistently |
| Normalize/coerce or truncate provider vectors | More responses appear usable | Changes meaning and conceals broken contracts; rejected |
| Automatic schema repair on mismatch | Appears to recover quickly | Can erase unrelated embeddings and indexes; rejected |
| Hard-code model catalog dimensions | Detects some wrong-model responses | Breaks reduced/custom dimensions and still cannot prove model-space compatibility |

Recommended stack: TLS and cancellation → decoded-byte budget → single-vector
shape/numeric validation → success accounting → defensive storage validation →
fixed database constraints. Do not infer matching model spaces from equal length.
Provider/model compatibility, index capacity and controlled migration need their
own preflight. No dependency, public API or automatic classification authority is
added. Independent study labels and frozen readiness gates remain separate.

## Validation plan

Exercise every adapter with real loopback HTTP responses and mocked cost storage;
reject malformed vectors without retry or success. Verify explicit dimension
mismatches before SQL and real pgvector errors against temporary tables. Compare
stored text, images, dimensions and indexes before/after rejection. Run backend
regressions, static checks and a no-cache local Compose build with runtime checks.
Record the measured result in the separate
[outcome document](embedding-vector-validation-outcome.md).
