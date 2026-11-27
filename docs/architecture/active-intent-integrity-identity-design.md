# Exact active-intent integrity report IDs

The read-only integrity report receives PostgreSQL BIGINT intent IDs. A
production-builder probe with otherwise tied IDs `9007199254740992` and
`9007199254740993` returned the same rounded number twice in
`activeIntentIds`, selected the lower value as canonical, and reported an
empty duplicate list. The SQL loader selects the IDs exactly. The loss
occurs in the JavaScript report builder.

The reconciliation lifecycle and recovery probe require a clean report.
Candidate eligibility also blocks policies with a duplicate finding. These
callers use the status and count to make their decisions. The existing
single-active-intent index protects current writes, and the historical
migration ranks native BIGINT values in SQL.

## Proposed contract

Use the existing positive BIGINT validator at the report boundary. Preserve
safe IDs as numbers and return larger IDs as canonical decimal strings.
Compare IDs exactly and keep the existing authority order by validation
status, intent version, acceptance time, update time, creation time, and
finally descending ID. List active and duplicate IDs in ascending numeric
order. Keep the report version, policy and version fields, and status names.

For a known duplicate group with an unusable or repeated ID, retain the row
count, list the distinct usable IDs, and use the existing blocked status
with no canonical candidate. This prevents incomplete evidence from clearing
reconciliation. The existing SQL, consumer checks, permissions, schema,
historical migration, and repair behavior remain outside this change.

## Research and tradeoffs

Reviewed November 27, 2026. PostgreSQL stores BIGINT exactly up to
`9223372036854775807`. RFC 7493 recommends JSON strings for integers that
exceed the interoperable numeric range. W3C Data on the Web Best Practices
supports machine-readable, locale-neutral formats. Canonical decimal
strings apply that guidance to this report. [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

PostgreSQL documents explicit tie-break ordering. ECMAScript 2026 converts
array sort comparator results to Number, so use an exact relational
comparison that returns a numeric ordering sign. [PostgreSQL sorting](https://www.postgresql.org/docs/18/queries-order.html) ·
[ECMA-262 §23.1.3.30](https://262.ecma-international.org/index.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep safe numbers and use exact strings above the safe range | Preserves safe report values and correctly identifies every supported row | Consumers of large IDs must accept decimal strings |
| Return every intent ID as a string | Gives the report a single ID type | Changes the current safe-ID contract |
| Move ranking into the SQL loader | Uses PostgreSQL's native BIGINT ordering | Leaves the standalone builder exposed or requires a second ranking implementation |
| Introduce UUIDv7 | Can provide time-ordered identifiers generated independently | Requires an identity and recovery migration with its own use case |

Use the shared validator, an exact comparator in the existing report
module, and the current fail-closed status for incomplete duplicate groups.
Keep UUIDv7 work tied to a demonstrated identifier requirement and a
validated recovery plan. [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) ·
[Classifarr UUIDv7 readiness](classification-uuidv7-readiness-outcome.md)

## Verification

Run the production loader against a transaction-local PostgreSQL fixture that
can represent legacy duplicates. The temporary table shadows the permanent
table for the test connection. [PostgreSQL temporary tables](https://www.postgresql.org/docs/18/sql-createtable.html)

Check adjacent large IDs, the PostgreSQL
maximum, safe numeric compatibility, authority priority, blocked findings,
and normal inactive and single-row exclusions. Verify candidate eligibility
using the report. Exercise a malformed or repeated ID in the pure builder
and run the existing reconciliation controls and normal backend gates.
