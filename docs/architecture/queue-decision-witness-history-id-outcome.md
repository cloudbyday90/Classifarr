# Queue decision witness History ID outcome

November 26, 2026. See the [design and tradeoffs](queue-decision-witness-history-id-design.md).

The witness endpoint now preserves the same validated History ID in
`classificationId` and `history.id`. Safe IDs remain JSON numbers, and larger
IDs are canonical decimal strings. The queued evaluation report uses the same
normalizer for its witness summary, so eligible large links survive from
PostgreSQL through the report. Queue task IDs and the witness fingerprint retain
their current contract.

## Verification

- The original reader returned `queue_decision_witness_invalid` for the first
  valid ID above JavaScript's safe-integer limit in the real PostgreSQL fixture.
  The fixed endpoint returns both adjacent IDs exactly, including the latest
  row when their timestamps tie. The fixture also checks a normal numeric ID,
  the safe-integer boundary, and PostgreSQL's BIGINT maximum.
- All 92 focused tests passed, covering invalid, rounded and mismatched History
  IDs, the queued report summary, and existing read-only scoped-token authorization.
  The stored witness and bounded response projection are used in the database
  fixture. Its transaction is rolled back in the isolated test database.
- The local CI stages passed with 64,741 backend tests, one existing skip, and
  7,739 client tests. Three Vue runtime probes reached their subprocess deadline
  on the first client run. All seven probes passed in isolation and on the full
  client rerun with the existing deadlines. The fresh reports passed the
  coverage ratchet. Lint, type checks, ESM checks, and root, server and client
  dependency audits passed.
- GitHub listed no open pull requests, including Dependabot pull requests.

## Next item

Map the queue task ID across request admission, polling, persisted witnesses
and fingerprints. PostgreSQL already stores it as BIGINT, and the current
witness and fingerprint expect a JavaScript safe integer. A future change to
queue task IDs needs a compatibility plan for receipts and diagnostic access.
Evaluate that work before selecting a UUIDv7 migration.
[Classification identity assessment](classification-uuidv7-readiness-outcome.md)
