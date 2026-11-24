# Exact selected library for native questions

Reviewed November 24, 2026. This follows the
[pending review read resilience outcome](pending-review-read-resilience-outcome.md).

Production deterministic selection matches the policy's library ID against a
row from the active library query. The native handoff and question writer
also support the legacy `library_id` property. Both coerced the selected
value with `Number()`. Astra confirmed that a whitespace-padded ID fails the
exact parser but can still pass the ordinary policy-auto identity check.
Rejecting envelope creation alone could therefore remove the review hold.
[ECMAScript number conversion](https://tc39.es/ecma262/2026/multipage/abstract-operations.html)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Validate only the two saved IDs | Preserves existing inputs. | Coercion can produce two matching IDs from an invalid selection. |
| Reject only at envelope admission | Prevents the invalid write in the envelope. | Earlier reads still receive the alias and ordinary routing can proceed without the review hold. |
| Validate selection before the handoff and at admission | Protects native reads, pending writes, and the existing review boundary. | A malformed selection needs fresh classification to obtain a destination. |

## Recommended implementation

1. Reuse the canonical positive PostgreSQL INTEGER parser at the selected
   library boundary. Preserve `id` precedence and use `library_id` when `id`
   is null or absent. Apply the check before native profile and routing
   configuration reads and before an envelope is created.
   [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
   [OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
2. When a supplied selection fails validation, clear the proposed library
   and retain operator review before normal persistence and routing. Keep
   existing questions and retry state. With no existing question, use the
   pending list's existing Retry Classification affordance.
3. Reuse the native read check in the admission audit. Newly emitted valid
   envelopes keep the same numeric copies, fields, and fingerprint inputs.
   Keep saved questions and receipts compatible with the preceding reader.
   [W3C API compatibility guidance](https://www.w3.org/TR/dwbp/)

Verify canonical numbers and strings, the INTEGER maximum, invalid types
and aliases, explicit precedence, matching saved copies, and the existing
pending, routing, and replay safeguards without a live provider.
