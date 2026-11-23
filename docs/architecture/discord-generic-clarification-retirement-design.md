# Retire generic Discord clarification buttons

November 23, 2026 Eastern. This follows the
[completed decision buttons outcome](discord-completed-buttons-bigint-outcome.md).

## Findings

The original Discord clarification renderer shipped in alpha releases. The
renderer is present in `v0.10-alpha` and `v0.40.3a-alpha`. Commit `3f6f94bff`
removed it during the move to policy-driven clarification. The renderer is
absent from `v0.49.4-beta` and current main. Astra independently verified the
history and traced the remaining server dispatch. Repository history establishes
what released source emitted. Live message retention varies by installation
and was outside this source audit.
[Initial alpha release](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.10-alpha),
[v0.40.3a-alpha release](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.40.3a-alpha),
[v0.49.4-beta release](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.49.4-beta)

The current generic `clarify` dispatch decodes its identifiers and invokes a
shared response writer without establishing that the saved Discord delivery
offered the historical question and answer. The writer also serves the
authenticated `/api/clarifications/:id/respond` route. The current Discord
`ai_clarify` and fingerprinted `ai_answer` controls follow separate handlers.

## Recommendation and tradeoffs

1. Reply to the retired `clarify` action privately with fixed text guiding
   the operator to the Classifarr Command Center. Respond before interpreting
   the historical identifiers or reading any storage. The reply uses the
   platform's ephemeral message flag and gives a plain-language next step.
   Discord's originating message field identifies the UI surface. Application
   authorization still depends on evidence that binds the action to the item.
   W3C status-message guidance informs the textual feedback. Discord clients
   control how replies are announced.
   [Discord interactions](https://docs.discord.com/developers/interactions/receiving-and-responding),
   [Discord.js reply flags](https://discord.js.org/docs/packages/discord.js/14.28.0/ButtonInteraction:Class#reply),
   [W3C WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
   [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
2. Remove the retired Discord response handler and its delegate. Leave the
   shared HTTP writer, stored responses, and active interaction paths in
   place. The active correction selector remains in its own service. The change
   fits the existing storage contract.

Old Discord buttons lose in-place submission and gain a clear recovery step.
Silently dropping the action would be smaller and leave operators without
feedback. Reconstructing write support would require independent evidence of
the actual issued question and answer, item eligibility, and replay state.
The legacy message reference and live question catalog cannot establish those
historical facts on their own.

## Verification

Verify the production interaction dispatcher replies once per retired click,
with the private flag, without deferring or editing the original message.
Test repeated clicks and inert legacy suffixes against a no-database-access
boundary. Verify current Discord interactions and the authenticated HTTP
clarification lifecycle with isolated fixtures. Run fresh backend coverage,
the coverage ratchet, and affected quality gates before pushing on main.
