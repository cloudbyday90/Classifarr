# Exact History IDs in Discord completed-item corrections

November 23, 2026 Eastern. This follows the
[verification and direct correction button outcome](discord-legacy-completed-buttons-outcome.md).

## Starting boundaries

PostgreSQL already stores the History primary key, Discord delivery reference,
and correction event reference as BIGINT. The database adapter returns safe
IDs as numbers and larger IDs as exact decimal text. The verification opener
and shared correction menu both rendered the whole ID. Their parsers rejected
IDs beyond JavaScript's safe-integer range. The correction writer, final
outcome writer, and provider routing bind the History ID in SQL using query
parameters. [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
[ECMAScript numeric types](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html)

Astra independently traced the write path and identified the original-decision
snapshot as a separate limit. It can capture History IDs through PostgreSQL
INTEGER max, 2,147,483,647. Above that, Classifarr can record a correction
event, its typed item and destination evidence, and the current History
outcome. The optional original-decision snapshot is unavailable. Its consumers
include evaluation grouping, intake recovery, feedback, and purpose reports.
The recovery query also declares the ID as INTEGER. The earlier
[reclassification design](reclassification-history-bigint-design.md) preserves
the same snapshot boundary.

## Recommendation and tradeoffs

1. Widen `verify_no` and `library_select` together with the existing canonical
   database ID parser. Keep the current component grammar and destination ID
   domain. Decimal text preserves adjacent large IDs. Retaining numeric values
   for safe IDs preserves existing in-process shapes, at the cost of a
   number-or-string domain which consumers must handle explicitly.
2. Reuse the offered-control check and locked delivery receipt check. Treat
   the component identifier as a reference to look up. Keep the receipt, row
   status, destination and routing checks authoritative. The existing wire
   format fits Discord's value limit even at BIGINT max. W3C's URI opacity
   principle applies by analogy. [Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx),
   [W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity)
3. Carry the exact History ID through the correction transaction and provider
   routing. For a prospective snapshot upgrade, use a compatible versioned
   representation, verify all recovery and evaluation consumers, and retain
   existing numeric records. Keeping the current snapshot boundary in this
   batch isolates the correction workflow. Expanding snapshots in the same
   batch would close the evidence gap sooner and broaden changes to evaluation
   and recovery. [I-JSON numeric interoperability](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2)

Widening only the selector would leave large confidence notifications unable
to open it. Widening all legacy buttons would extend action admission beyond
the two-step correction workflow. The current 25-option menu limit applies
independently of the History ID representation.

## Verification plan

Exercise actual Discord.js components, the delivery repository and isolated
PostgreSQL. Check INTEGER max plus one, adjacent IDs beyond the safe-integer
range, and BIGINT max. Assert the exact offered value, locked receipt, correction
foreign key, final History outcome, unaffected neighbor and single provider
route on duplicate selection. Test malformed and out-of-range controls,
cross-notification binding, current eligibility, and the original-decision
snapshot boundary separately.
