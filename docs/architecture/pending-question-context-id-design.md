# Exact pending-question context references

Reviewed November 24, 2026. This follows the
[pending-answer destination outcome](pending-answer-destination-id-outcome.md).

Pending questions save policy and library references inside JSON. The shared
extractor used `parseInt` on these values. PostgreSQL rejects an out-of-range
element in an `integer[]` parameter. A single failed lookup then reaches the
pending list's catch and produces an empty queue. Astra traced the same
references into cleanup inventory and locked cleanup apply. History row IDs
continue to use their separate BIGINT representation.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Catch freshness errors per row | Preserves other rows in the list. | Cleanup can still fail, and partial numeric strings can identify a different row. |
| Discard individual invalid references | Keeps SQL arguments within range. | An incomplete question can appear current and pass answer or replay checks. |
| Reject malformed reference sets and retain the row | Gives each affected question a safe recovery path and preserves valid neighbors. | Older questions with noncanonical reference values require fresh evaluation. |

## Recommended implementation

1. Use the existing positive INTEGER parser on the candidate, option and
   anchor references already used for freshness. Accept numbers and canonical
   decimal strings through 2,147,483,647. Preserve absent or null optional
   references, deduplication and first-seen order. Suppress lookups and new
   stamps for an invalid set. Keep an existing saved question visible.
   A new save uses the existing cleanup placeholder and strips old content.
   [OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
2. Use the existing stale fields and Retry control, with a fixed reason for
   invalid context. Reject a fresh answer under the existing row lock using
   the existing stale `409`. Omit the answer contract before invalid values
   can reach display projection. Keep response fields, valid fingerprints,
   destinations and completed receipt replay compatible.
   [W3C API compatibility guidance](https://www.w3.org/TR/dwbp/)
   Skip the dashboard's fallback destination label for this state. Verify
   the existing refresh status and keyboard-operable Retry button.
   [W3C status-message technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
   [W3C keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard)
3. Keep invalid references out of cleanup inventory's batched lookups. Mark
   their context unavailable and use the existing fresh-evaluation path under
   the apply lock. Preserve the selected-row limit, existing receipts and
   learning safeguards.

Verify both offending ID types in the real pending route with a valid neighbor,
then check locked refusal and cleanup with and without a saved answer. Exercise
valid INTEGER bounds, fingerprint stability and completed replay. Genuine
database outages and the list's existing error reporting remain a follow-up.
