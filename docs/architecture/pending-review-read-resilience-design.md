# Pending review read resilience

Reviewed November 24, 2026. This follows the
[pending context reference repair](pending-question-context-id-outcome.md).

Native questions save a destination in their persistence metadata and on the
resolve option. Both must identify the same library. Astra reproduced numeric
coercion accepting a padded string and a one-element array. A JSON object
could also throw while projecting the answer and hide valid neighbors.
Separately, the primary pending query returned an empty list on failure, and
Command Center presented an empty queue whenever it lacked review data.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Display the option's ID when the copies disagree | Retains actions for more historical questions. | Chooses a destination without matching saved evidence. |
| Reject the whole list whenever any check fails | Gives callers one clear failure response. | Makes unrelated reviews unavailable. |
| Require agreement and isolate individual lookup failures | Preserves healthy reviews and distinguishes a read retry from a classification retry. | Requires an explicit row status and an unavailable list state. |

## Recommended implementation

1. Validate both native destination IDs with the existing positive PostgreSQL
   INTEGER rule. Require agreement before display and freshness inspection.
   Keep canonical decimal strings and numbers equivalent. Invalid saved
   destinations use the existing stale refusal and classification retry.
   Preserve valid fingerprints and completed, row-bound receipt replay.
   [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
   [OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
2. Share freshness lookups for matching contexts within a request. A failed
   lookup marks its rows `policy_context_unavailable` and omits their answer
   contracts. Other rows remain usable. A failed primary read returns a fixed
   `503` and preserves the shared statement-timeout response. Successful
   reads retain their existing shape, including a confirmed empty list.
   [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
3. Distinguish initial loading, unavailable reads, and confirmed empty lists.
   Offer a keyboard-operable read refresh while the list or individual
   context is unavailable. Omit affected rows from bulk writes. Reuse the
   existing read polling, authorization, and locked write checks.
   [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   [W3C keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard)

Verify exact boundaries, malformed and mismatched saved IDs, healthy
neighbors, write refusal, and receipt replay in isolated PostgreSQL. Inject
primary and per-context read failures and verify browser recovery with no
classification write from the refresh control.
