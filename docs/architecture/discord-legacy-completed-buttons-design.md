# Discord verification and direct correction button design

November 23, 2026 Eastern. This follows the
[Discord decision and correction split](discord-selector-decision-separation-outcome.md).

## Contract

Keep the existing `correct`, `reclassify`, `verify_yes`, and `verify_no`
button formats. Decode full canonical History IDs in the current safe-integer
range and destination IDs in the database's existing positive 32-bit range.
Require the exact enabled button on the message Discord supplied. On the
History row, require the exact saved message and a delivered receipt for the
same row, message, and expected notification kind. A classification receipt
supports the classification buttons. A confidence receipt supports the
verification buttons. In both cases the delivery must have started on a
completed or routed row. If Classifarr lacks this evidence, direct the user
to Classifarr.

Follow the existing History-then-receipt lock order. An affirmative button
can verify a completed decision. A verified or routed row is a no-op when
the delivery evidence still matches. A corrected, pending, or superseded row
cannot receive a new verification. Commit the verification status and outcome
in one transaction. Start any existing provider routing after commit. Keep
the correction writer as the owner of correction and its outcome evidence.

The verification opener checks the same binding before listing destinations.
Release its database locks before editing the Discord message. The menu's
subsequent selection repeats its existing transactional checks because the
row can change after the options are shown. Astra confirmed that all four
buttons reach these same gateway paths and that the verification handler
previously wrote the status and outcome separately.

## Tradeoffs and recommendation

Reuse the delivered receipt, current row lock, and exact offered component.
This keeps valid button IDs and avoids a schema change. Old messages without
delivery evidence require review in Classifarr. A message-only check would
retain more stale controls and would omit evidence of the original delivery
type. Versioned controls could eventually bind the exact destination revision
at send time. That requires a separate format and compatibility decision.

The lock serializes verification and its outcome and suppresses a duplicate
verification write. Routing starts after commit. Separate accepted commands
can still interact with the same provider item.

The existing opener renders the eligible libraries in one menu. Discord caps
that menu at 25 options, so larger library lists can fail to render.
[Discord string selects](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx#string-select)

Discord documents the supplied message, component ID and deferred update.
Check application authorization on every request. Apply W3C's identifier
opacity guidance by analogy by resolving current state from storage. PostgreSQL
row locks keep the state check and write together. [Discord interactions](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx),
[Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx),
[OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request),
[W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity),
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)

## Verification

Use actual Discord.js components and isolated PostgreSQL. Check both
affirmative button forms, duplicate clicks, rollback when outcome writing
fails, binding changes while waiting on the row, obsolete pending deliveries,
and the opener-to-menu flow. Check current compact and legacy pending
boundaries and direct correction with a local provider stand-in.
