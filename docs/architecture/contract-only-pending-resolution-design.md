# Contract-only pending classification resolution

Reviewed November 24, 2026. This follows the
[Discord clarification retirement](discord-indexed-clarification-retirement-outcome.md).

The generic `resolvePolicyQuestion` method lost its only bundled caller when
Discord retired index-only buttons. The shared transaction still accepts a
free-form label, a destination supplied independently of the answer, and no
answer receipt. Astra traced production callers and confirmed that the web
route and compact Discord controls already send the versioned answer, with
exact History IDs up to the PostgreSQL BIGINT maximum.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the generic entry point | Supports private callers that may have copied the previous method. | Keeps an optional-proof writer and two History ID admission rules. |
| Remove only the generic method | Shrinks the facade and leaves most tests intact. | The transaction can still acknowledge a completed row based on library alone. |
| Require the answer at the transaction boundary | Makes the existing answer checks mandatory and derives the destination from the same command. | Private callers and fixtures using the old positional signature must move to the versioned payload. |

## Recommended implementation

1. Parse the existing wire answer before opening the shared transaction.
   Admit only resolution actions and exact positive BIGINT History IDs. Use
   numbers through the JSON safe range and exact decimal strings above it.
   [RFC 8259 numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)
2. Keep the locked question, destination, freshness and Discord message
   checks at their existing write boundary. Derive the option and saved
   receipt from the validated answer. Changing the identifier format would
   still require the existing authorization and object binding.
   [PostgreSQL row-level locking](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
   · [OWASP API object authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/)
   · [RFC 9562 UUID security considerations](https://www.rfc-editor.org/rfc/rfc9562.html#section-8)
3. Preserve both public transports, response fields and saved receipt
   precedence. A completed row needs a matching version, fingerprint, action
   and destination. Safe IDs can still replay older unbound receipts. Large
   IDs require exact row binding. Replay can invoke the existing idempotent
   learning command and never repeats routing.
   [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

Verify the shared admission boundary directly and exercise web, compact
Discord, adjacent large IDs and saved receipts in isolated PostgreSQL. Keep
the old missing-question and missing-receipt cases as refusal regressions.
Use the existing transaction and post-commit learning service.
