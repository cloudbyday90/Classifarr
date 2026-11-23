# Exact History IDs in resolution learning

Reviewed November 22, 2026 Eastern. Follow-up to the
[native pending provenance repair](native-pending-provenance-bigint-outcome.md).

## Contract

The outcome-only runtime resolution producer and the automatic exact-item
memory adapter both convert History IDs through JavaScript `Number`. Two
adjacent PostgreSQL BIGINTs can therefore produce one event key or one lock
target. The pending answer entry point currently limits IDs to safe integers.
This change prepares the two internal producers for later widening.

Use the existing bounded History ID validator once in each producer. Leave
safe IDs numeric and preserve larger canonical decimal strings through the
resolution intake, outcome patch and automatic learning command. Invalid IDs
retain the producers' existing blocked or not-applicable result and cannot
reach the automatic command. Keep destination and media identifiers on their
existing contracts.

The outcome-only producer cannot authorize a learning write. The automatic
adapter still requires successful resolution, an eligible action and an
authenticated actor. Its existing command locks the History row, revalidates
the saved answer and destination, and claims the existing source-event receipt
in the same transaction as the learning effect. Keep the public pending-answer
limit, manual command route, answer fingerprint, receipt identity and schema.

## Official guidance and tradeoffs

PostgreSQL BIGINT extends beyond the exact integer range widely supported by
JSON consumers. RFC 8785 recommends decimal strings when integer precision
exceeds binary64. Keep the same numeric representation in the safe range to
retain existing serialized outcome and receipt compatibility. This does not
change Classifarr's fingerprint serializer.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)

W3C Web Architecture recommends distinct, consistently used identifiers for
distinct resources. Apply the principle to Classifarr's internal event keys
and locked row references. These event keys are internal identifiers.
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

PostgreSQL row locks last through transaction completion, and a transaction
commits its effects atomically. Keep the receipt claim and learning effect
in the existing transaction against the exact locked row.
[PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html),
[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

The recommended stack is exact validation at the two producers, canonical
decimal text for large IDs and the existing guarded database transaction for
automatic learning. It preserves row identity and safe event bytes without
a schema migration. Consumers handle two scalar representations. A string-only
contract would simplify types but require wider compatibility work, and a
wider public admission change would require fingerprint and replay proof.

## Verification

Exercise adjacent large IDs, the PostgreSQL maximum, invalid input, and safe
numeric and string equivalence. Use an isolated PostgreSQL fixture with two
completed rows to verify exact automatic learning, the receipt's row identity
and idempotent replay. Verify that the existing pending command still refuses
large IDs and replays safe answers. Run focused tests, fresh backend coverage
and the normal quality gates.

## Follow-up

Review History ID parsing at the manual exact-item memory route separately.
Before lifting the pending-answer cap, pin safe fingerprint bytes, verify
exact decimal fingerprints for large IDs, and exercise completed replay
through the shared resolver and its web, bulk and Discord entry points.
