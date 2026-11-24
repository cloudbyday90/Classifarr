# Exact destination IDs for new pending answers

Reviewed November 24, 2026. This follows the
[contract-only resolver outcome](contract-only-pending-resolution-outcome.md).

The answer parser previously applied `Number()` to the destination before
the web route queried `libraries`. The browser also converted selection
values before building the command. Astra confirmed that compact Discord
controls already validate against the positive PostgreSQL INTEGER range.
`libraries.id` uses `integer`. History uses BIGINT and keeps its own contract.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep numeric coercion | Preserves every previously accepted input. | Unexpected types can become a valid ID and overflow can reach PostgreSQL. |
| Tighten new commands and stored readers together | Applies one input rule throughout. | Can change cleanup or replay of saved answers whose earlier encoding was tolerated. |
| Validate new commands and preserve stored decoding | Matches Discord, protects the lookup, and preserves saved-answer behavior. | Requires an explicit saved-answer decoder and rejects noncanonical client input. |

## Recommended implementation

1. Accept a positive whole number in the range 1 through 2,147,483,647, or
   its canonical decimal string. Normalize accepted commands to numbers.
   Run the server check before a library query or transaction and use the
   existing validation response. Keep the existing action and destination
   eligibility checks.
   [OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
2. Use the same range in browser answer construction and in the recommendation
   values used by Confirm All. Forward DOM selections until they can be
   validated. Keep the existing browser error guidance and response shape.
   [W3C API compatibility guidance](https://www.w3.org/TR/2017/REC-dwbp-20170131/)
3. Give cleanup an explicit stored-answer decoder with its previous semantics.
   The first and current receipt writers serialize normalized numeric
   destinations. Retain the tolerant read path for historical JSON, including
   existing row binding, fingerprint and destination checks. Keep the
   completed duplicate comparison and receipt serialization stable.

Verify numeric and canonical-string commands and the maximum INTEGER. Check
that invalid commands perform no lookup or write. Exercise real web answers,
Discord controls, completed replay and cleanup against isolated PostgreSQL.
