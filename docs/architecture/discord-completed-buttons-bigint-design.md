# Exact History IDs in Discord completed decision buttons

November 23, 2026 Eastern. This follows the
[completed correction outcome](discord-completed-correction-bigint-outcome.md)
and the [original-decision snapshot outcome](original-decision-snapshot-bigint-outcome.md).

## Finding and scope

Discord already renders the full History ID in `correct`, `verify_yes`, and
`reclassify`. Their shared parser rejects IDs above JavaScript's safe-integer
limit. The `verify_no` opener and completed correction selector already accept
the full positive PostgreSQL BIGINT range. Astra independently traced both
mutation paths and found that the shared parser is the remaining limiting
boundary for these three buttons. The existing correction snapshot also
carries an exact large History ID.

## Recommended design

1. Parse the existing bounded button format by action token and exact arity.
   Reuse the canonical BIGINT normalizer for all completed buttons, preserving
   safe numbers and returning larger IDs as exact decimal text. Keep the
   destination library bounded to positive PostgreSQL INTEGER. The longest
   current ID is 41 characters. Keep the existing button labels, delivery
   format, and safe-ID behavior. [Discord component reference](https://docs.discord.com/developers/components/reference),
   [PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html),
   [I-JSON exact integer interoperability](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2)
2. Keep authority in the existing offered-button check, saved message and
   kind-specific delivery receipt. Under the History lock, verification
   requires a completed row with a saved library and recognizes previously
   verified or routed rows. Direct correction rechecks completed eligibility,
   active media-compatible destination and the existing same-library replay
   condition. Discord includes the originating message on component
   interactions. W3C identifier opacity applies by analogy to treating a
   component ID as a reference while proving eligibility separately. [Discord interaction structure](https://docs.discord.com/developers/interactions/receiving-and-responding),
   [W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity),
   [PostgreSQL row-level locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
3. Preserve the transaction and post-commit routing sequence. A failed or
   unacknowledged write keeps the existing failure handling. A duplicate
   successful action continues through the existing state-based replay check.
   Completed actions continue to produce no pending learning intake. Pending
   controls keep their current independent binding and ID rules.

## Tradeoffs

The existing wire format preserves delivered messages and needs no new storage.
It retains a mixed internal number-or-string representation. A new tokenized
format could make bindings more explicit while introducing token lifecycle and
migration work. Retaining the cap would keep the current refusal behavior and
leave three controls unusable on very large rows. The existing stored receipt
remains required for older messages, regardless of ID size.

## Verification

First demonstrate that valid large buttons fail against the unchanged parser.
Verify the installed Discord.js renderer and parser, adjacent BIGINT IDs,
BIGINT max, malformed tokens and destination overflow. Use isolated PostgreSQL
to verify the saved message and receipt, the History lock, exact outcome and
correction rows, original snapshot, duplicate actions, rollback and routing to
the correct item and library. Recheck the existing opener, selector, and
pending controls and run fresh backend coverage and repository quality gates.
