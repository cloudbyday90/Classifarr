# Retiring Discord’s index-only clarification controls

Reviewed November 23, 2026. This is the next step from the
[pending-question cleanup outcome](pending-question-cleanup-history-ids-outcome.md).

The older confidence notification encodes a History ID and an option index
in `ai_clarify_`. The click handler reads the option label from the message
and resolves to the History row’s saved library. The message binding and row
lock establish which row the interaction reached. Neither establishes the
destination the option meant at delivery. Historical pending and confidence
senders both used this format for different question presentations. Astra
confirmed that clicks on rows with a stored policy question already direct
operators to the current queue state. Fresh pending persistence normally
stores a null library, whereas the legacy writer needs a saved library and an
absent policy question.

The active `ai_answer_` control carries an exact History ID, action,
destination and question fingerprint. The answer service checks the offered
button, saved message and current question. Keep that path as the Discord
answer surface. Discord’s component IDs identify controls, and a UUIDv7
would still need a separate proof of the offered decision.
[Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx)
· [RFC 9562](https://datatracker.ietf.org/doc/html/rfc9562)

## Options

| Approach | Benefit | Cost |
| --- | --- | --- |
| Widen the existing button ID | Preserves the click flow on old messages. | The option still lacks decision proof even with an exact row ID. |
| Stop new buttons and keep old writes | Avoids sending new index-only controls while retaining old one-click answers. | Keeps the ambiguous write path for old and deferred messages. |
| Retire index-only writes and guide operators to review | Keeps the old click recognizable and directs users to the current review. | Old messages can still show a clickable button, and users must switch to Classifarr. |

## Recommended implementation

1. Replace the old index-only click path with the existing private retirement
   reply. Give the same reply for any payload in the retired action family.
   The reply does no History lookup, write, routing, or message edit.
   [Discord interaction responses](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx)
2. Render the legacy clarification tier with Command Center guidance and no
   controls. Point the operator to **Retry Classification** when the current
   question is unavailable. Keep the established delivery kind, configuration
   checks, status, and receipt. Apply W3C’s text and actionable recovery
   guidance to the message copy.
   [WCAG 2.2 input assistance](https://www.w3.org/WAI/WCAG22/Understanding/input-assistance.html)
3. Keep the fingerprinted pending path, completed controls, and generic
   resolver contract separate. Retained Discord payloads and delivered
   messages can still carry old buttons. The same private reply handles them
   without rewriting or resending those messages.

Verify the real renderers and dispatcher locally. Test a previously accepted
safe-ID click, large and malformed retired identifiers, fresh notification
rendering, and the unchanged receipt-bound compact and completed paths.
Exercise saved rows in isolated PostgreSQL and verify their configured review
and routing rules through the adjacent control suites.
