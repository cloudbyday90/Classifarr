# Exact History IDs in native pending provenance

November 22, 2026 Eastern. Follow-up to the
[pending resolution ID admission outcome](pending-resolution-id-admission-outcome.md).

## Problem and scope

Native pending resolution and its terminal routing outcome independently
convert the Classification History ID to a JavaScript number before building
the `classification:<id>` source event key. Adjacent PostgreSQL BIGINT values
can produce the same key. The route outcome also carries the normalized ID
into its final outcome. The pending answer owner currently admits only safe
integers, so this repair prepares the provenance producers for later widening.

Use the existing bounded database ID validator at both producers. Safe IDs
retain their numeric representation and existing event keys. Canonical
positive decimal strings above the safe range remain exact through PostgreSQL's
maximum. Invalid History IDs cannot produce audited native resolution intake
or a persistable native route outcome. Keep the native destination validators,
learning guards and stored outcome projections as they are. Preserve the
existing pending answer limit, fingerprints, receipts and replay behavior.

## Official guidance and tradeoffs

PostgreSQL supports positive BIGINT values through `9223372036854775807`.
RFC 8259 identifies the smaller binary64 integer range on which JSON consumers
can agree exactly. RFC 8785 recommends strings for longer integers where
exact canonical JSON matters. Keep safe IDs numeric for compatibility and use
canonical decimal strings for larger values. This is a representation choice
within Classifarr's existing contracts and does not replace its serializer.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)

W3C Web Architecture recommends consistent identification across interactions.
Classifarr applies that principle by deriving each internal event key from the
exact History row identity. Two different rows need distinct event keys
regardless of whether the ID is safe to represent as a JSON number.
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

The recommended stack is the existing canonical ID validator, compatible
numeric-or-decimal representation and two outcome-only producers. It retains
existing safe event keys and avoids a schema migration. The tradeoff is that
callers must distinguish numbers from decimal strings and pending answers
remain capped until the downstream consumers are ready. A string-only or
UUIDv7 replacement would require a wider identity and replay migration.

## Verification and next boundary

Exercise adjacent IDs above the safe range, the PostgreSQL maximum, invalid
inputs, and equal safe number and string inputs. Cover validated request-time
and fallback resolution intake, terminal route outcomes and isolated
PostgreSQL row targeting. Use the current HTTP resolution and completed
replay regression to verify the existing answer limit and receipt contract.

The next prerequisites are exact pending answer fingerprints and resolution
learning, including automatic exact-item learning. Preserve safe fingerprint
bytes before extending the admitted range. Review destination evidence's
shared execution state and its separate library, intent and policy IDs at
their respective boundaries.
