# Observed-evidence marker restore outcome

A saved retention marker records the owners at the time of redaction. It
keeps those IDs when the configuration backup is restored. The snapshot's
foreign keys identify its current owners. The change documents and tests the
existing restore behavior and backup format.

## PostgreSQL verification

- The real initial-establishment path captured two snapshots. Retention
  redacted one with intent and establishment ID `9007199254740993`, stored
  as decimal strings. The regression checked its digest against the original
  observed payload.
- Configuration export and JSON round-trip fed two replace restores. The
  second restore used a fresh export of the first restored state. Policy
  and library IDs became `1001` and then `2001`. Intent and establishment
  IDs became `1002` and then `2002`. The historical marker, its digest and
  types, and the snapshot's fingerprint and redaction timestamps survived.
- Single and bulk native policy reads and the scoped evidence digest
  recognized the restored snapshot as redacted. Their projections omitted
  the payload and marker. Retention skipped the already-redacted snapshot.
- A merge repeat preserved both snapshots. When the unredacted snapshot
  expired, retention redacted that row alone and recorded the restored
  owner's IDs, with the expected digest. The earlier marker stayed intact.
- The isolated PostgreSQL 18 run passed 28 tests across five suites. The
  focused backend run passed 152 tests across 18 suites. Astra reviewed
  the regression, and each round-trip now checks full JSON equality.

The regression exercises configuration backup and restore. A full recovery
drill for an installation and repair of older inexact JSON IDs are separate
concerns.

## Quality gates

Local verification used Node 24.22.3 and npm 12.2.2. Preflight, policy
gates, backend and client type checks, server and documentation lint, and
schema checks passed. Fresh backend coverage passed 64,983 tests across
1,959 suites with one existing skip and 89.33% statement coverage. The
client report recorded 7,751 passing tests and 87.84% statement coverage.
Its inputs and SHA-256 were verified before reuse. The coverage ratchet,
ESM checks, and staged secret scan passed. All three production dependency
audits reported zero vulnerabilities.

The disposable PostgreSQL fixtures were removed. The local Classifarr
container retained its identity, start time, and healthy status. GitHub
listed zero open pull requests.

## Follow-up

Qualify rollback-snapshot retention across backup restore. The archive
stores the marker's source migration-event ID in JSON while separately
restoring the migration-event records and mapping relational links.
Fresh redaction looks for a creation event with an exact `snapshotId` in
its metadata. Restore copies that metadata while assigning new snapshot
IDs. Test both the historical marker and the fresh provenance lookup in
isolated PostgreSQL before deciding whether any mapping needs to change.

[Design, official sources, and tradeoffs](observed-evidence-marker-restore-design.md)
