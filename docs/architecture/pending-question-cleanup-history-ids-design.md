# Exact History IDs and freshness in pending-question cleanup

Reviewed November 23, 2026.

## Cause and scope

The dry-run plan narrows History IDs to JavaScript numbers. Apply and
outcome replay then reject IDs above the safe integer limit even though the
History, clarification-response, and cleanup-audit columns are BIGINT. The
same IDs already participate in exact runtime-answer fingerprints and the
existing retry scheduler can carry them.

The recorded-answer plan is a candidate for replay. The write path currently
forces `isStale: false`, which can approve a matching receipt after the policy
context changes. This repair checks freshness and availability before replay
can write an outcome. A stale question or unavailable referenced policy takes
the existing fresh-runtime evaluation path.

## Options

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Keep the safe-integer cap | Smallest compatibility surface. | Inventory can still round IDs and cleanup cannot address large rows. |
| Use one exact ID contract across cleanup | The preview and apply agree. Existing safe IDs and receipt formats remain compatible. | Clients must allow decimal strings for large IDs. Replay needs the existing row and freshness checks. |
| Add a new version or UUID selector | Could establish a new identity contract. | Requires a migration or a new lookup surface for an existing BIGINT capability. |

## Recommendation

1. Use the shared positive BIGINT normalizer for inventory plans and apply.
   Keep safe numbers and larger canonical decimal strings. Reject invalid,
   duplicate, empty, or over-limit batches before opening a transaction.
   Keep the existing 100-ID cap and sort by exact numeric value before
   acquiring row locks.
   [PostgreSQL BIGINT](https://www.postgresql.org/docs/18/datatype-numeric.html)
   · [RFC 8259 numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)
   · [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
2. Preserve the administrator and read-write rules and server-derived plan.
   Check the receipt against the locked row, requiring the existing explicit
   binding for large IDs. Keep the existing fingerprint and active destination
   checks. Send changed or unavailable policy context to the existing retry
   path. The preview may still identify a recorded answer as a candidate.
   [W3C API compatibility guidance](https://www.w3.org/TR/dwbp/)
3. Keep the current transaction, audit and retry markers. A queued retry
   reuses its saved receipt and schedule on another apply. A completed row
   stays unchanged on another apply and can produce a separate compact audit.
   Cleanup performs no learning or remote routing. The existing scheduler
   owns later retry admission, cooldowns, attempts, and provider work.

Verify the actual authenticated endpoints with isolated PostgreSQL, including
adjacent IDs, the BIGINT maximum, reverse batch order, invalid input, exact
row-bound replay, stale and unavailable context, and untouched neighboring
rows. The batch is complete when those checks and the repository gates pass.
