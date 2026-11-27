# Rollback snapshot restore provenance outcome

Fresh redaction can recover the matching library rebuild creation event
after configuration restore assigns new snapshot and event IDs. Restore
sets the event's private `retentionSnapshotId` using the destination
snapshot ID returned by PostgreSQL. It preserves the original capture
reference used by rebuild replay and lifecycle checks.

The restore step verifies the archive row, owners, revision, and matching
producer evidence. PostgreSQL checks the original JSON reference and adds
the mapped field in the same insert, preserving the rest of the event
metadata. The retention worker checks the saved evidence again against
its locked snapshot. An explicit null or invalid reference keeps the
source unavailable. Multiple matching events also leave a gap. Expired
payloads still redact, and the existing marker and maintenance event
formats carry the result.

## Verification

- The initial PostgreSQL 18 probe redacted a restored snapshot but
  recorded a null source event. The production-path regression now
  restores and re-exports that capture across two sets of IDs. Fresh
  cleanup records the restored creation event with the exact snapshot
  ID at the BIGINT maximum.
- A merge with an existing rebuild leaves its capture event and snapshot
  unchanged. Replay passes with a large verification-run ID. Cleanup
  attributes the original and adjacent imported snapshots to their own
  events.
- Restore preserves the already-redacted marker and the earlier
  maintenance event. Their source IDs still describe the original
  redaction, and expired cleanup skips that snapshot.
- The worker redacts with empty source fields after conflicting creation
  events, a mismatched native capture, an inexact reference, duplicate
  source rows, an unexpected actor ID, or missing proof. An explicit
  null survives re-export and restore. A check-constraint failure during
  event insertion rolls back the replacement.
- Astra identified precision loss when an older archive supplies its
  event metadata as raw JSON text. The regression verifies that
  PostgreSQL preserves the raw `9007199254740993` numeric token and
  refuses a fractional reference that JavaScript would round to a safe
  integer. Existing archives containing already-rounded values can
  still lack usable provenance.
- Nine isolated PostgreSQL suites passed 72 tests, including the
  authenticated backup lifecycle. Seventeen focused backend suites
  passed 157 tests. The scoped PostgreSQL coverage run reported 99.36%
  statement coverage across the provenance and retention modules.

## Quality gates

Fresh backend coverage passed 64,994 tests across 1,959 suites with one
existing skip and 89.31% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. Its inputs and
SHA-256 matched the prior run. The coverage ratchet, preflight, policy
gates, type checks, ESM checks, server and documentation lint, schema
check, and staged secret scan passed. All three production dependency
audits reported zero vulnerabilities.

The ownership gate flagged the changed restore file. Its reviewed
operation, analysis digest, and unresolved classification matched the
previous manifest. Only the reviewed source digest was refreshed.
Disposable PostgreSQL fixtures were removed. The local Classifarr
container retained its identity, start time, and healthy status.
GitHub listed zero open pull requests.

## Follow-up

Verify the rollback snapshot writer used by post-upgrade conversion and
native-intent reconciliation. It records a creation event with a restore
path and no exact snapshot ID. Check whether the writer can capture the
inserted ID in the same transaction and preserve that proof across
restore. Historical events with only a path should keep their existing
provenance gap.

[Design, official sources, and tradeoffs](rollback-snapshot-restore-provenance-design.md)
