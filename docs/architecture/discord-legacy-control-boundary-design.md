# Legacy Discord control identity and message binding

November 23, 2026 Eastern. This follows the
[compact answer outcome](discord-compact-answer-bigint-outcome.md).

## Contract

Keep the existing legacy button and selector formats. Parse the entire
`ai_clarify` button ID and exactly one `library_select` value. History IDs
must be canonical positive safe integers. Destination IDs must be canonical
positive PostgreSQL INTEGER values. Accept the five supported button indices
and require a presented option with the exact button ID and a nonblank label
for a legacy clarification.

Use the stored `classification_history.discord_message_id` as the binding
for both write paths. Reject missing or different message IDs with guidance
to open Classifarr. The clarification handler can reject early and verifies
the same binding again after the resolver locks the row. At that point it
also checks the saved destination and absence of a stored policy question.
Any current stored question uses the existing Classifarr review path.

The shared library selector enters the existing correction transaction with
an explicit expected message ID. Check it on the locked row before locking
the destination, applying the correction, or recording evidence. Keep its
existing correction semantics, destination checks, and ordering. Other
correction buttons, the compact contract, and default resolver callers
retain their current entry points and authorization. Keep provider routing
outside the write transactions and preserve the no-second-route replay.

## Recommendations and tradeoffs

The recommended stack combines exact parsing, a stored row/message match,
and a repeat check at the write boundary. This prevents rounded selectors
and stale message bindings while preserving the existing wire formats.
Older messages without a stored binding require an answer in Classifarr.
Using only an early lookup would cost fewer checks and leave a write race.
Adding a new bound legacy format would support more precise option
provenance and require migration and backward-compatibility decisions.

Astra confirmed that the existing delivery receipt identifies a message and
its classification. It carries no snapshot of the question options. Keep
the safe-ID cap until that distinction and the separate correction paths
are qualified. W3C identifier guidance supports exact identity. Discord
documents the interaction message and select values. OWASP recommends
checking authority on each request, and PostgreSQL holds row locks until
transaction end. [W3C Web Architecture](https://www.w3.org/TR/webarch/#identification),
[Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx#string-select),
[Discord interaction reference](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx),
[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request),
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)

## Verification

Exercise exact safe IDs, malformed and oversized selectors, unrelated
menus, missing message bindings, and unavailable option indices. Use
isolated PostgreSQL to check both successful paths, replacement of the
binding or question after an initial observation, and duplicate replies.
Keep compact and direct correction controls covered. Local Discord and
routing stands-ins provide deterministic provider call counts.
