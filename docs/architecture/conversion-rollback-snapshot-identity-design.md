# Exact rollback snapshot identity for policy conversion

The post-upgrade apply gate and native-intent reconciliation use the same
transaction to create native intent, capture a rollback snapshot, and write
migration events. A disposable PostgreSQL 18 probe gave their snapshots
IDs `9007199254740992` and `9007199254740993`. Both creation events had
the correct policy, intent, revision, and actor. They saved a restore path
without the snapshot ID. When retention redacted the snapshots, both
markers recorded an empty source event.

Configuration restore can assign fresh snapshot and event IDs. Merge can
also reuse an existing intent and import a second capture under its owners.
If the imported creation event keeps only the source snapshot ID as its
lookup key, it can compete with the original snapshot's event while the
imported snapshot loses its link. Astra recommends fixing the producer and
its restore boundary together.

## Proposed contract

Use PostgreSQL's existing snapshot insert to return and verify its ID,
policy, intent, revision, and stored restore path. Save that exact ID as
`snapshotId` on the creation event. Use the existing JSON-compatible
BIGINT convention, with safe numbers and decimal strings above the safe
range. Keep the capture revision aligned with the admitted conversion
revision. Keep the existing actor, reason, path, and event order. Use the
creation event's insert acknowledgement to verify its saved row, owners,
revision, and typed JSON reference before committing. An absent or
mismatched acknowledgement fails through the existing transaction result.

On restore, qualify the recognized conversion creation event through the
archive's unique snapshot ID, exact owners, revision, actor source, and
stored path. Preserve the original `snapshotId` and use the existing
restore-owned `retentionSnapshotId` for the destination. An explicit null
records a gap when proof is absent or cannot be verified. Validate the
original JSON representation in PostgreSQL so raw archive metadata
keeps its precision. Retention uses the mapped link when present for
recognized conversion events, including treating a null link as a gap.
It checks the existing owner and revision boundaries and the producer's
stored path. Competing qualified conversion events leave provenance
unavailable. Earlier path-only events still cannot establish identity.
Other capture producers keep their own proof rules.

Keep the existing conversion locks, reconciliation hold checks, budget,
atomic ordering, idempotent already-converted path, and outward result
shape. Missing proof during cleanup does not stop expiry and redaction.
Keep redaction markers and earlier audit events as historical records.
This adds no schema, route, job, or requirement to run recovery manually.

## Guidance and tradeoffs

Reviewed November 27, 2026. PostgreSQL's `RETURNING` exposes the row
produced by an insert, including generated values and trigger changes.
The transaction keeps the snapshot and event visible together.
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

I-JSON recommends strings for exact integers beyond the interoperable
numeric range. W3C provenance distinguishes the generated entity from
later derivations. Preserve the original event reference while binding
the restored copy independently. OWASP logging guidance supports an
attributable record with only the fields needed for its purpose.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) ·
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)

| Option | Benefit | Cost |
| --- | --- | --- |
| Capture the exact ID and qualify the restored link | Fresh redaction keeps the correct provenance in local and restored configurations | Adds producer-specific proof to restore and retention |
| Capture the ID and discard its attribution on restore | Bounds the change while stopping false attribution | A later supported restore still loses genuine provenance |
| Infer historical links from restore paths | Could fill additional historical gaps | Paths can be shared and do not prove snapshot identity |

Use the shared BIGINT validator, a small conversion-capture module, and
the existing restore identity mapping. Verify the event before committing
and keep missing evidence explicit during cleanup.

## Verification

Exercise the real PostgreSQL post-upgrade and reconciliation paths,
including safe and adjacent large IDs, replay, reconciliation admission,
and `RETURNING` failures that roll back the transaction. Cover fresh
retention, merge into the source database, a replace and re-export,
and historical unbound events. Verify historical markers and the existing
rebuild proof. Run affected tests and the usual local gates. Record the
outcome separately, update Unreleased, and push on main without a release.
