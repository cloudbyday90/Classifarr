# Exact observed-evidence retention IDs

The daily retention worker replaces expired provenance payloads with a summary.
An isolated PostgreSQL probe provided adjacent rows at `9007199254740992`
and `9007199254740993`. PostgreSQL selected and updated both exactly. The
marker for the upper row retained the lower intent and establishment IDs,
and the cleanup result reported one snapshot instead of two. The current
update acknowledgement checks only that an ID was returned.

## Proposed contract

Validate the selected snapshot, intent, and establishment IDs using the
existing positive BIGINT validator. Keep safe IDs numeric and carry larger
ones as canonical decimal strings. Preserve exact owner IDs in new markers
and exact snapshot IDs in the result and its count.

Check the updated row ID and relational owner IDs against the locked row
before committing. Read back only the stored marker's two owner fields
with their JSON types. Require exact values and types, including strings
above JavaScript's safe range. The database trigger guards the relational
columns and the one-way redaction transition. It checks that a marker
exists, which leaves validation of its nested IDs to this worker.

Keep the daily entry point, the transaction advisory lock, the bounded
ordered `FOR UPDATE SKIP LOCKED` selection, expiry, status, and digest.
A missing or mismatched update acknowledgement rolls back the whole batch.
A later run uses the existing redaction flag to avoid repeating an update
that committed. Existing markers, backup reference mapping, and the
provenance, routing, and learning boundaries remain as they are.

## Research and recommendation

Reviewed November 27, 2026. I-JSON recommends strings for exact integer
values beyond the interoperable numeric range. W3C guidance on
locale-neutral representation and provenance supports canonical decimal
text and retaining the actual owner IDs. Keep the existing format for
safe IDs.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

PostgreSQL `RETURNING` exposes the stored row, including trigger changes.
Use JSONB extraction to return the two typed values without retrieving the
original payload. Reuse the current lock and ordered batch. OWASP logging
guidance supports retaining only the data necessary for an attributable
record and excluding sensitive payloads from operation logs.
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html) ·
[PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) ·
[PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html) ·
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Change JSON field conversions only | Small patch and exact representation | A neighboring update or incorrect marker can still pass acknowledgement |
| Preserve exact IDs and verify the stored marker in the same transaction | Exact evidence and rollback on a mismatched acknowledgement | Returns four more scalar fields for each updated row |
| Change the trigger and rewrite older markers | Central enforcement and a uniform historical shape | Requires a migration and a verified source for historical IDs that already lost precision |

Use the shared ID validator, the existing retention modules and locks, and
typed transaction-local acknowledgement. Historical markers already
persisted as unsafe numbers cannot provide exact JSON identity. Preserve
those records. The next candidate is the policy-change outcome observation
path, which rejects native change receipt IDs above the safe range.

## Verification

Use the real establishment and scheduled retention paths in isolated
PostgreSQL. Cover safe IDs, adjacent large snapshot and owner IDs, the
BIGINT maximum, expiry, locks, and repeated cleanup. Force a second update
to store a wrong or wrongly typed marker via the real table. Verify that
both updates roll back and that the original payload stays out of
successful markers and results. Run the affected quality gates and record
the results separately.
