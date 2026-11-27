# Exact rollback snapshot retention IDs

The scheduled rollback retention worker redacts expired snapshots and writes a
maintenance event for each changed row. An isolated PostgreSQL probe found
that the current worker reports adjacent snapshot IDs `9007199254740992` and
`9007199254740993` as one. A capture event and an original intent at the upper
ID both become the lower ID in the marker. The source lookup also returns a
sibling event when no exact reference matches and can accept an unsafe
historical JSON number. With no source event at all, the marker builder throws.

## Proposed contract

Use the existing positive BIGINT validator for the selected snapshot, its
original intent, its source event and the retention event acknowledgement.
Write safe IDs as JSON numbers and larger IDs as canonical decimal strings
where the marker, event metadata, and batch result carry those references.
Leave policy IDs, actor IDs, versions, and the payload digest algorithm at
their existing boundaries.

Accept a source only from a capture event with the matching policy, original
intent, snapshot version and explicit snapshot ID. Compare the saved JSON
text to a validated decimal parameter and require a string for IDs above
JavaScript's safe integer range. Safe legacy JSON numbers and canonical
decimal strings both qualify. If several events explicitly match, keep the
existing newest-first ordering. Record null source fields for absent,
unbound, malformed, unsafe numeric or mismatched references and continue
redaction. Older post-upgrade and initial-establishment snapshots can take
this path. Their events remain available in the migration history.

Keep the transaction advisory lock and ordered, bounded row locking.
Compare the returned snapshot ID with the locked selection. Verify the
retention event acknowledgement and exact row linkage before commit.
A database read failure or an unsuccessful update or event write rolls
the whole batch back. A scheduled rerun observes the saved redaction flag
and does not emit a second event for an already-redacted row. Keep existing
expiry, batch size, schedule, status, sanitized logging, and the behavior
at the shared transaction boundary. Existing markers and events require no
rewrite. No schema change or new operator trigger is needed.

## Research and recommendation

Reviewed November 27, 2026. I-JSON recommends strings for exact integers
beyond interoperable numeric precision. W3C recommends locale-neutral
representation and documenting provenance. Apply both to the retained
audit fields with canonical decimal strings and explicit gaps where source
evidence is missing.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/)

PostgreSQL exposes the stored JSON value's text and type separately and
reports the actual updated or inserted row with `RETURNING`. Reuse the
existing ordered `SKIP LOCKED` selection and transaction advisory lock
for scheduled batches. OWASP's logging guidance favors an attributable
audit trail and minimizing sensitive retained data. Keep the current
digest and minimal marker.
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html) ·
[PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) ·
[PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Widen only the JSON fields | Small patch and exact output | Retains sibling attribution and failed batches without a source |
| Require explicit source identity and redact with null source fields when unavailable | Corrects both faults and preserves bounded cleanup | Older unbound events no longer appear as marker provenance |
| Recover source links through producer-specific receipts | Can explain additional older snapshots with durable links | Adds producer-specific joins and proof rules and still leaves some historical rows unbound |

Use the shared ID validator, the existing marker and persistence modules,
an exact typed source lookup, and transaction-local acknowledgement
checks. Defer producer-specific source recovery. The next independent
repair is observed-evidence retention, which narrows its own snapshot,
intent, and establishment IDs.

## Verification

Exercise the existing worker and scheduler contracts in isolated PostgreSQL.
Cover safe and adjacent large IDs, the BIGINT maximum, absent and sibling
source events, historical numeric JSON, expiry and skipped locks, failed
acknowledgements, atomic rollback, and an idempotent second pass. Verify
the stored marker and event without exposing the original payload. Run the
affected quality gates and record the results in a separate outcome.
