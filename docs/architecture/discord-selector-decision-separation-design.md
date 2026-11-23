# Discord pending answers and completed corrections

November 23, 2026 Eastern. This follows the
[legacy control boundary](discord-legacy-control-boundary-outcome.md).

## Contract

Keep `library_select` as a completed-item correction. Its exact selector and
saved message binding still apply. Under the existing History lock, require
a current completed, routed, verified, or corrected row and a matching
delivered receipt for a notification originally sent on a completed or routed
row. Require the clicked destination on an enabled menu with the existing
classification-correction or verification-correction placeholder. Match that
control to the receipt kind. Confidence configuration can set its recorded
action independently of the displayed menu. Refuse unknown controls or
missing delivery proof and direct the operator to Classifarr. The receipt check
follows the History lock and precedes the destination lock and any write.

Astra identified the important transition case. An old pending menu can
survive a later decision. Current status alone could turn that menu into
a different command. The delivered receipt already records the message and
the source status and notification kind. Keep ambiguous legacy menus out of
both write paths, including after the row reaches a completed state. For an
unsent row already awaiting a decision, the confidence notification fallback
uses the existing pending sender and its settings and delivery gate.

Use the existing compact Discord button for a pending answer. Parse its
exact wire ID and require that an enabled button with that ID is present in
the interaction's message. Pass the expected message into the existing answer
transaction. Recheck the exact stored message, current answer fingerprint,
action and candidate on the locked row. Keep exact row-bound receipt replay,
learning admission and external routing order. The interaction's component
list shows what Discord supplied for the click. The locked question and
candidate establish Classifarr's current decision authority.

## Tradeoffs and recommendation

Reuse compact buttons for pending decisions and the delivered receipt for
legacy completed corrections. This keeps wire formats and schema stable.
Older completed menus without proof require review in Classifarr. Relying on
the current state alone would preserve more old controls and would let a
pending menu change meaning. A dedicated pending menu would add another
versioned display surface and is unnecessary for this separation.

Discord documents the message and components associated with an interaction.
Treat identifiers as opaque input and validate authority at use time. Keep
the existing transactional checks and avoid a second provider action on
completed replay. [Discord interactions](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx),
[Discord components](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx),
[W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity),
[OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request),
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)

## Verification

Test a real delivered completed menu, old pending menus before and after
resolution, absent and mismatched receipts, and a changed current status.
Test compact options that are present, absent, disabled or stale, a changed
message under lock, exact BIGINT handling and completed replay. Verify the
existing web, legacy clarification and direct correction boundaries with
isolated PostgreSQL and local provider stand-ins.
