# Bounded comparison snapshot decoding

Date: 2026-10-06. Follows the [phase investigation](comparison-memory-phases-outcome.md).

## Decision and contract

The representative/comparison repository currently captures every encoded vector
before decoding after commit. SQL batches alone do not bound that retained text.
Decode one batch at a time into the final private vector map, inside the existing
repeatable-read, read-only transaction. Do not reuse an earlier snapshot or skip
the independently read verification snapshot. This changes allocation lifetime,
not vector values, training membership, fingerprints or publication criteria.

Use a small ESM reader over the existing parameterized vector transport. Validate
the complete hash list before SQL; retain exact representation, expiry, duplicate,
scope and embedding validation. Limit a batch to 256 rows and 262144 components
(the smaller bound wins). Decode in a separate function scope, then yield to the
event loop so cancellation can run and encoded rows are no longer needed. Normal
GC remains in control; neither a yield nor an unreachable object promises an
immediate RSS reduction. The final map remains bounded by the existing repository
component limit. Other cache consumers keep their current capture/decode contract.

Pass the existing refresher signal into both initial and verification reads.
Check cancellation before acquiring a transaction, around each query and at batch
boundaries. An in-flight SQL statement is not forcibly cancelled by this change;
the existing 15-second statement timeout bounds it. Keep the 1-second lock,
20-second idle-transaction and 90-second total transaction timeouts. No HTTP occurs
inside the transaction. Decode errors/cancellation roll back and cannot publish a
partial map; connection ownership and release stay with `withTransaction`.

No new scheduler, persistent state, retry budget, concurrency, migration or
ownership policy. Fresh/empty corpora issue no vector query. Missing cache entries
retain the existing complete-only refusal or partial representative semantics.
Corrupt/unknown failures remain unavailable through existing sanitized diagnostics;
shutdown remains cancelled. Existing retry/backoff and admission guards are not
changed. A crash discards the read-only transaction; the next admitted run starts
with a fresh snapshot. Model/configuration revision checks still govern publication.

## Options and validation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Decode bounded batches within one snapshot | Avoids retaining all encoded vectors; small change | Holds the transaction during bounded decoding; implement and measure |
| Cursor or binary transport | Potentially less text/transport allocation | New lifecycle/driver or codec contract; defer until measured |
| Reuse verification input | Avoids another read | Can publish stale state; reject |
| Raise memory limits or force GC | May hide pressure | Does not fix allocation ownership; reject |

Prove exact vectors and fingerprints, both budget bounds, corrupt/duplicate/scope
refusal, incomplete/empty behavior, cancellation and rollback. Use isolated real
PostgreSQL to update/delete rows between batches and confirm one snapshot remains
consistent while a later read sees the change. Repeat the existing 5776-vector,
1024-dimension study with unchanged resource limits; compare collected controls
and natural elapsed cycles. No memory reduction claim without measured evidence.
Rebuild local Compose without cache after backup; dump/check the schema using
isolated candidate-image databases. Never modify Unraid or its appdata.

## Official sources

Discovered and retrieved through MCP on October 6, 2026:

- [PostgreSQL repeatable read](https://www.postgresql.org/docs/18/transaction-iso.html)
  establishes a consistent view across successive queries in one transaction.
- [node-postgres transactions](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/transactions.mdx)
  requires the same client for the whole transaction.
- [Parameterized queries](https://node-postgres.com/features/queries) keeps values
  separate from SQL; no user-controlled identifier or raw SQL is introduced.
- [PostgreSQL transaction timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html)
  distinguishes statement, idle-transaction and transaction lifetime bounds.
- [Node timers](https://github.com/nodejs/node/blob/main/doc/api/timers.md) documents
  the cancellable promise-based immediate used for cooperative yielding.

These sources support the design's semantics, not its performance outcome. Record
results and remaining opportunities in a separate outcome document.
