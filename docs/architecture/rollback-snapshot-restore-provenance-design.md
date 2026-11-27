# Rollback snapshot provenance across configuration restore

A disposable PostgreSQL 18 probe exercised Classifarr's library rebuild
capture, configuration export, replace restore, and scheduled retention
service. The source snapshot ID was `9007199254740993` and its creation
event ID was `9007199254740995`. A replace restore assigned snapshot
and event ID `1900` in their respective tables. Their relational policy
and intent links matched. The creation event still named the source
snapshot in its `snapshotId` metadata. Cleanup redacted the restored
payload with an empty source. A separate restore of the already-redacted
archive preserved both the historical marker and redaction event and
skipped a second redaction.

## Proposed contract

Configuration restore maps the local reference used by retention for
recognized library rebuild creation events. After the snapshot insert
returns its destination ID, use its exact archive ID, policy, intent,
revision, and the complete saved acceptance evidence to qualify the
source link. The acceptance evidence includes the transition, proposal,
and rollback-plan fingerprints, operator source and reference, and the
event's acceptance key. Require a unique archive snapshot and a successful
destination mapping. Store the destination ID in `retentionSnapshotId`
on the imported creation event. Record explicit null when proof is
missing, noncanonical, or ambiguous. On re-export and subsequent restore,
the field's presence determines which archive link to qualify. A saved
null retains the gap. Safe IDs stay numeric and larger IDs stay exact
decimal strings.

Retention uses the separate reference only for recognized rebuild creation
events and checks the same producer evidence against the locked snapshot.
For a native creation event without that field, the existing exact
`snapshotId` comparison still applies and the rebuild evidence must agree.
If more than one proven rebuild event matches, record no source. Other
producers keep their exact typed matching and existing order. A rebuild
snapshot with incomplete proof redacts with an empty source. This leaves
older archives with an already-disconnected link eligible for redaction
and makes no inference from neighboring IDs.

The original creation `snapshotId` remains the recorded capture reference
used by rebuild replay and lifecycle checks. Already-redacted snapshots,
their markers, and maintenance event metadata stay historical. Keep the
version 2.0 archive, existing authorization and transactions, locks, expiry,
batch limits, cleanup status, and payload digests. The private reference
supplies retention provenance. It carries no replay, replacement, or
routing authority.

## Guidance and tradeoffs

Reviewed November 27, 2026. W3C distinguishes an original generation
from later derivation. Classifarr can preserve what the capture recorded
and carry an independent link for the restored row. NIST recovery guidance
supports exercising the actual restore and subsequent operation on an
isolated system. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) ·
[NIST contingency planning](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)

I-JSON recommends strings for integers beyond interoperable JSON precision.
PostgreSQL `RETURNING` yields the row identity assigned by the database.
Its JSON operators distinguish value types and missing keys. Use the
existing ID validator and mapped insertion result, and retain an explicit
gap for unproved links.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Restore a separate, verified retention reference | Keeps the original proof and identifies the imported event's matching snapshot across replace, merge, and re-export | Adds a private metadata field and a producer-specific qualification |
| Reconstruct the link at cleanup from matching timestamps and fingerprints | Leaves the backup writer and restore mapping alone | Requires durable uniqueness across duplicate imports and previously redacted siblings, and timestamps can lose precision in an export |
| Keep the current empty source after ID remapping | Preserves format and deletion behavior with the smallest change | Loses useful known provenance on otherwise valid restorations |

Astra recommends the separate reference. Use the transaction's existing
ID maps, a small shared rebuild provenance module, and the worker's
existing refusal and null-source path. The check qualifies retained
producer records. It does not authenticate an externally modified archive.

## Verification

Use isolated PostgreSQL and the real capture, configuration export,
restore, and retention services. Exercise fresh cleanup after replace,
re-export and a second replace, large and safe destination IDs, a merge
with existing rows, and invalid or competing evidence. Verify both the
historical marker and maintenance event across restore, and the destination
references on new redaction. Run affected backup, lifecycle, and retention
suites and the usual local gates. Record the outcome separately, update
Unreleased, and push on main.
