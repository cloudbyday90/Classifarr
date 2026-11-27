# Active-intent integrity report outcome

The report now identifies both rows when adjacent BIGINT intent IDs differ
above JavaScript's safe-integer limit. It preserves safe numeric IDs, emits
larger IDs as decimal strings, and orders both ID lists numerically. An
unusable or repeated ID in a duplicate group leaves the finding blocked,
with the original row count and the distinct usable IDs. The report
withholds a canonical candidate in that case.

## Local verification

- Five new unit cases failed against the old builder. The focused backend
  run passed 148 tests after the repair, including existing report and
  reconciliation consumers.
- Eleven integration tests passed in isolated PostgreSQL, including the
  existing migration and concurrency tests. A transaction-local fixture
  exercised the production loader with adjacent large IDs, the BIGINT
  maximum, mixed ID widths, a zero ID, and an inactive row. A higher
  version with a warning still lost to a valid candidate.
- The database-backed report kept both duplicate groups ineligible.
  Restore verification rejected the duplicate fixture and passed after
  the temporary fixture contained one active row per policy.
- Server lint, migration naming and snapshot checks, and ownership
  validation passed. The root, server, and client production dependency
  audits reported zero vulnerabilities.

The report, lifecycle, and candidate eligibility continue to use the
existing authority statuses. The current database constraint continues
to enforce one active intent per policy. Astra reviewed the report logic
and confirmed the existing consumers use its status.

## Quality gates

The full backend run passed 64,959 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client coverage report
recorded 7,751 passing tests and 87.84% statement coverage. Its inputs and
SHA-256 were verified before reuse. Preflight, policy gates, server and
client type checks, ESM import and mock-shape checks, the coverage ratchet,
documentation lint, and the staged secret scan passed.

The isolated PostgreSQL fixtures were removed by test teardown. The
protected local Classifarr container retained its identity, start time,
and healthy status. GitHub showed zero open PRs during this batch.

## Follow-up

Qualify large-ID native-change receipts in the policy-purpose provenance
readers. Their shared SQL currently accepts the target of an applied
receipt without the same-attempt evidence required by command replay.
Check its effect on inventory, coverage, and held-out re-audit in
isolated PostgreSQL before deciding whether to change those readers.

[Design, sources, and tradeoffs](active-intent-integrity-identity-design.md)
