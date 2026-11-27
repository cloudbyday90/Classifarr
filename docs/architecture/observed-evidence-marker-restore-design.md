# Observed-evidence retention markers across backup restore

A disposable PostgreSQL probe captured two observed-evidence snapshots through
initial establishment. The retention service redacted the first. Its marker
recorded the owner IDs at redaction, a digest and size of the removed payload,
and the original capture details.

The probe used the configuration export and transactional restore owners to
round-trip the backup twice. The second backup came from the first restored
database state. Each replace restore assigned different local IDs to the
observed snapshot's policy, library, intent, and establishment. The redacted
marker retained its original owner IDs and digest through both passes. Policy
and evidence-digest readers used the restored relational rows and their
redaction flag. A cleanup pass skipped the restored redacted snapshot.
When the second snapshot later expired, cleanup created its first marker
with the destination IDs.

## Proposed contract

Treat the owner IDs in a saved retention marker as the IDs at the time of
redaction. The relational links on the snapshot address the current
database rows. A restore, re-export, and later restore may change those
links again. A future reader may present the marker as historical evidence
and should use the row's foreign keys to resolve its present owners.

Add an isolated PostgreSQL regression for this existing behavior. Verify
both restore passes, typed exact IDs, the retained payload digest, the
readers' aggregate projections, and redaction on the destination. Include
a merge repeat to check that an existing marker stays stored. Keep the
existing backup format, restore mapping, recognition of redacted rows,
privacy, and retention authority. The tests exercise Classifarr's
configuration backup and data restore owners.

## Guidance and tradeoffs

Reviewed November 27, 2026. W3C PROV-DM distinguishes an entity generated
by an activity from later entities derived from it. An audit marker
records the earlier redaction, and the restored row has its own current
identity. NIST contingency-planning guidance includes recovery testing.
Exercise the actual restore with a different set of destination IDs.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) ·
[NIST contingency planning](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)

I-JSON recommends decimal strings for integers outside the interoperable
numeric range. PostgreSQL JSONB preserves the structured values while it
normalizes object order and whitespace. Compare the parsed marker values
and types across restore. The retained digest describes the removed
payload using Classifarr's existing stable serialization.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Preserve the marker and test the restore boundary | Keeps exact historical evidence through repeated imports | Any future reader needs to understand the difference between historical and current owner IDs |
| Rewrite the recognized marker's owner IDs during restore | Makes the imported marker match the destination row | Changes the recorded owners of the original redaction and requires a decision for ambiguous historical IDs |
| Store a separate restore attribution record | Could track source and destination across installations | Adds a schema and lifecycle for an extra record |

Use exact remapped relational links, the original typed marker, and the
existing aggregate projections. A historical marker alone supplies no
additional authorization or routing authority. Astra reviewed the
divergence and evaluated the rewrite option. The probe found that current
consumers use the relational owner, so recording and testing the existing
boundary is the recommended first change.

## Verification

Use real observed capture, the retention transaction, configuration
export, and transactional restore in the disposable suite. Check
redacted and unredacted snapshots after two replace passes and a merge
repeat. Verify policy and evidence-digest projections, retained
redaction facts, and future cleanup using the destination links.
Run affected backup and retention suites and the normal quality gates.
Record the separate outcome, update Unreleased, and push on main.
