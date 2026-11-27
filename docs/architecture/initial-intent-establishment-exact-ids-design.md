# Exact identities in initial native intent establishment

## Evidence

The establishment transaction stores BIGINT references to the first intent
and its rollback snapshot. The fresh and replayed HTTP results convert the
establishment, intent, and snapshot IDs to JavaScript numbers. Readiness
does the same and uses the converted intent ID in its declared-rules query.

With adjacent IDs in disposable PostgreSQL, the receipt for
`9007199254740993` stored all three references exactly. Both write responses
and the readiness projection returned `9007199254740992`. Readiness also
returned the lower intent's rules. The write responses for the BIGINT
maximum returned `9223372036854776000`. Its readiness request returned 503.
The same-key native policy-create response also rounded its intent ID.

## Design

Validate the generated establishment, intent, and snapshot IDs with the
existing database BIGINT normalizer before carrying them into dependent
writes. Check that completion returns the reserved establishment ID inside
the transaction. An invalid generated ID or mismatched completion follows
the transaction failure path. Carry the three exact IDs through successful
establishment, matching replay, and readiness. An invalid completed receipt
uses the existing refusal path without a replacement write.

Use the exact saved intent ID for the parameterized readiness rules query.
Keep the response shape and existing unavailable evidence states. Native
policy creation preserves the exact `intentId` already in its fresh and
replayed summary. The three receipt fields use numbers through JavaScript's
safe range and canonical decimal strings above it.

The admin and actor checks, policy locks, request fingerprints, and state
transition stay in charge of writes. A matching saved request recovers its
receipt after a lost acknowledgement. The existing rollback expiry,
manifest, and authority checks still govern a subsequent rollback request.

## Research and recommendation

Reviewed November 26, 2026. PostgreSQL `RETURNING` exposes values from the
actual modified row. The node-postgres type parser preserves `int8` values
as text when numeric conversion cannot preserve them. Keep those values
exact through dependent statements and check the returned reservation ID.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[node-postgres type parsing](https://github.com/brianc/node-pg-types)

RFC 8259 identifies the interoperable integer range for binary64 consumers.
W3C guidance on stable identifiers and locale-neutral representations
supports using the same canonical decimal spelling in a response and its
subsequent request. The mixed number/string representation is Classifarr's
compatibility choice. [RFC 8259 §6](https://datatracker.ietf.org/doc/html/rfc8259#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Repair the snapshot field alone | Small response change | Readiness can still return a neighboring intent's rules |
| Use decimal strings for every receipt ID | Uniform response type | Existing safe-ID consumers face a type change |
| Preserve the entire receipt and exact rule selector | Correct identity through establishment, replay, and rollback handoff | Consumers handle numbers and strings |

Use the shared normalizer, the existing parameterized SQL and transaction,
and compatible JSON projections across the producer and readers. Verify
the stored receipt and rollback handoff together.

## Verification

Exercise the existing admin routes in isolated PostgreSQL with safe IDs,
adjacent large IDs carrying different rules, and the BIGINT maximum. Use
the exact snapshot returned by readiness in the existing reversion route.
Check fresh and replayed native create summaries. Verify refusal and atomic
rollback for invalid returned IDs, exact receipt recovery after a lost
acknowledgement, and administrator access. Run focused tests and the
affected quality gates.
