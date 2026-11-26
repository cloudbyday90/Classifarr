# Exact queue task IDs in decision witnesses and sweep reports

November 26, 2026. Queue task storage, admission responses, and queue lists
already preserve PostgreSQL BIGINT identity. The witness builder, read route,
repository and sweep still narrowed those IDs to JavaScript numbers. A queued
sweep also accepted any available witness response before checking whether it
belonged to the submitted task. The maintainer approved changing these paths
together after an independent Astra review.

## Research and tradeoffs

PostgreSQL BIGINT stores positive IDs through 9,223,372,036,854,775,807.
RFC 8259 identifies integers through 9,007,199,254,740,991 as exactly
interoperable across binary64 JSON implementations. RFC 8785 describes why
deterministic hashing needs an invariant representation and recommends JSON
strings for longer integers. Classifarr retains its existing fingerprint
serializer. W3C guidance on structural metadata, version indicators, and
compatible API changes supports documenting the two representations explicitly.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[RFC 8785, Appendix D](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-D) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Expand v1 to numbers and strings | Uses one version identifier | Changes the field type under a published fingerprint contract |
| Use v2 for every ID | Gives new witnesses one uniform representation | Changes future fingerprints and cohort comparisons for safe IDs |
| Use v2 only above the JSON safe-integer limit | Preserves producer-written v1 fingerprints while representing all task IDs | Readers handle two explicitly typed witness versions |

## Recommended implementation

1. Keep v1 byte-for-byte compatible for witnesses with positive safe numeric
   task IDs. Pin a known pre-change fingerprint. New large IDs use v2 with a
   canonical decimal string. Each version requires its documented field
   type. The existing SHA-256 input binds the version, exact task ID and
   bounded outcome. It serves as an integrity check within the authorized
   read path.
2. Reuse exact task ID validation at the existing witness route and SQL
   lookup. Require the requested task, stored task reference and witness to
   agree. Keep the existing History association, foreign keys, storage
   lifetime and classification's best-effort witness persistence.
3. In the sweep, carry the normalized task ID from submission into lifecycle
   polling and the report. Require the matching response envelope and valid
   witness, and require its History ID fields to agree before recording or
   grading. Skip invalid or unbound responses within the current poll budget.
   The poll deadline bounds when the next request can start. Webhook log IDs
   remain numeric. Keep scoped authorization, routing guards, receipts, and
   the direct-classification path.
4. Exercise both witness versions with real PostgreSQL and HTTP, including
   adjacent task IDs, BIGINT maximum, and stored identity mismatch. Run the
   CLI against an isolated loopback fixture to verify the exact URL, report
   fields, and refusal to record or grade a different task's evidence.

Existing saved v1 witnesses require no rewrite. A previous verifier accepted
coerced task ID spellings, but the production builder persisted numeric v1
IDs. The stricter wire contract rejects variant spellings and version or type
swaps. Both versions fit the existing BIGINT foreign key and JSONB witness.
