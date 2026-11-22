# Exact History IDs for shared routing writes

November 22, 2026 Eastern. Follow-up to the
[manual routing check repair](manual-routing-check-bigint-outcome.md).

## Failure and decision

The shared routing metadata builder converts `classification_history.id` to
a JavaScript number before binding it. The History column already uses
`BIGINT`, and the manual selection, classifier persistence and queue
admission paths already preserve the database representation. A valid
History ID above the JavaScript safe integer range therefore reaches the
builder intact and is rejected. The affected writes are the automatic
pre-provider marker, automatic routing closeout including skip outcomes,
and manual closeout of an already-issued operation.

Use the existing canonical database ID validator in the shared builder.
Bind the fourth parameter as exact decimal text in the existing BIGINT
predicate. Accept safe positive numbers and canonical decimal strings
through `9223372036854775807`. Refuse fractional, padded, overflowing and
coercible representations before a query. Keep the same fixed SQL, bounded
routing fields, status allowlist and partial JSONB update. No database
migration is needed for this column.

## Authority and lifecycle

- A manual selection still commits before provider dispatch. The outcome
  update still requires the exact library, completed status, pending routing
  state and saved attempt ID. A refused write or lost acknowledgement keeps
  the existing public unconfirmed result. A fresh History read can reveal a
  committed result. A duplicate selection cannot dispatch another write.
- Automatic queue admission still verifies the active claim, deadline and
  retry lineage where applicable. The pending History marker and task link
  commit together before provider dispatch. Failure or lost acknowledgement
  at admission does not grant dispatch. A later valid claim recovers the
  saved marker, with the existing no-replay behavior.
- An ordinary automatic closeout still uses the existing partial update and
  caller result handling. The ID fix does not add an ownership predicate
  there or a durable admission marker to unqueued routing. It also leaves
  current locks, provider timeouts, retries, cancellation, and background
  check admission in their current owners. Identity carries no authority.

## Official sources and tradeoffs

Sources retrieved through the connected search service on November 22, 2026.

- PostgreSQL `BIGINT` stores the full signed 64-bit range. PostgreSQL can
  resolve the existing parameter against the ID column, and node-postgres
  binds values separately from SQL. The direct binding avoids schema
  changes, duplicate identities and a global driver parser change.
  [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
  [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html),
  [node-postgres parameterized queries](https://node-postgres.com/features/queries)
- RFC 8259 identifies the interoperable range for JSON numbers. W3C Web
  Architecture distinguishes identity from representation. Here the
  application can keep the same identifier while preserving its decimal
  representation across JavaScript and PostgreSQL. Canonical validation
  deliberately refuses alternate spellings previously accepted by `Number`.
  [RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
  [W3C Web Architecture](https://www.w3.org/TR/webarch/)
- RFC 9110 limits automatic retry of non-idempotent requests. The practical
  boundary here is durable local admission and explicit uncertainty at the
  provider boundary. Reapplying a SQL patch or changing ID format cannot
  prove whether a provider mutation occurred.
  [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The recommended sequence is canonical ID binding, each caller's current
attempt and claim checks, atomic admission, and saved-result recovery. A
global conversion to JavaScript `BigInt` would change broader JSON and
caller contracts. New aliases or UUIDv7 keys would require migration and
compatibility work while leaving existing references to repair.

## Verification

Cover safe legacy IDs, adjacent IDs above JavaScript's safe range, the
BIGINT maximum and malformed input. In isolated PostgreSQL, verify precise
row targeting and preservation of unrelated metadata, stale manual attempts,
competing admissions, rollback, and lost acknowledgement after a real
write or commit. Exercise the automatic owner with the real writer and an
isolated provider fixture. Run focused and affected quality gates, and
record results in a separate outcome.
