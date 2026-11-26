# Exact web-search provider record IDs

## Decision

Web-search provider health events and route decisions each have a BIGINT
primary key. The two row readers convert their own `id` to a JavaScript
number. They are used for both insert results and saved history lists. A
baseline probe returned the same number for `9007199254740992` and
`9007199254740993` in both readers. The provider settings view uses the
health event ID as its Vue row key, so those records can share one key.

Apply the existing BIGINT normalizer to the record ID in each reader.
Use numbers for safe positive IDs and exact decimal strings above the safe
range. An unavailable or invalid identity projects as null. Keep the
independent route UUID, optional `classificationId`, query limits, native
SQL ordering, administrator access, and existing keyed rendering. The
same conversion applies when a routing result carries the saved decision.

## Research and tradeoffs

PostgreSQL's signed BIGINT range exceeds the exact interoperable JSON
integer range described by RFC 8259. Canonical decimal strings provide a
locale-neutral representation for the remaining values within the same
JSON response. Vue supports primitive string and number keys and requires
sibling keys to be unique.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) ·
[Vue key contract](https://vuejs.org/api/built-in-special-attributes.html#key)

| Option | Benefit | Cost |
| --- | --- | --- |
| Shared BIGINT normalization in both readers | Preserves numeric compatibility and exact identities in all consumers | Consumers handle two JSON ID types |
| Return all IDs as strings | Provides one JSON type | Changes every existing numeric ID response |
| Change the health list's key alone | Limits the change to one view | Leaves the API's precision loss and requires a substitute identity |
| Change the database driver's parsers globally | Centralizes representation | Changes the contract for unrelated database readers |

Use the shared normalizer at the existing row boundaries, preserve the
transport values as parsed JSON, and use the existing stable Vue keys.

## Verification

Use isolated PostgreSQL to exercise real insert results and administrator
diagnostics at a safe number, adjacent large values, and the BIGINT
maximum. Keep distinct correlation IDs, linked History values, and route
UUIDs in the fixture. Check that Vue retains each row when a diagnostics
refresh changes its position. Run affected client and server checks and
the repository's quality gates.
