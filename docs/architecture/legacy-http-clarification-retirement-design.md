# Retire legacy HTTP clarification submissions

November 23, 2026 Eastern. This follows the
[Discord clarification retirement](discord-generic-clarification-retirement-outcome.md).

## Caller and state audit

`POST /api/clarifications/:id/respond` is the last production caller of the
generic clarification response writer. The Command Center submits pending
decisions through `POST /api/classification/pending/:id/resolve`. Prompt
responses use a separate contract. Astra independently traced the current
client, server, and removed Discord caller. Repository evidence covers the
bundled product and leaves usage by external integrations unknown.

The legacy HTTP handler accepts item, actor, question, and starting confidence
from the request body. The writer reads the live question catalog, inserts a
response, and updates History in separate operations. Supporting submissions
safely would require proof of the exact question and answer offered for the
item, server-owned actor and confidence, and an atomic write with a stable
per-issuance replay contract. Current application flows already have their own
admission and response contracts.

## Recommendation and tradeoffs

1. Keep the old POST route under its current middleware and return a fixed
   `410 Gone` JSON error with `Cache-Control: no-store` and a stable
   `clarification_response_retired` code. Once admitted by middleware, the
   response is independent of resource existence and request values. Keep
   the existing JSON error shape. In HTTP, `410` communicates permanent
   removal. A deprecation-only header would leave the old operation available.
   [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11),
   [HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5),
   [Deprecation header](https://www.rfc-editor.org/rfc/rfc9745.html#section-5)
2. Guide operators to the Classifarr Command Center. Old clients receive a
   readable response at the existing URL. Automatic redirection could send
   the old mutation body to a different contract. Keeping explicit feedback
   at the old endpoint follows W3C guidance on durable identifiers by analogy.
   [W3C Web Architecture](https://www.w3.org/TR/webarch/#URI-persistence),
   [W3C suggested correction text](https://www.w3.org/WAI/WCAG22/Techniques/general/G177)
3. Delete the now-exclusive writer and its service delegate. Keep question
   lookup and settings, reads of recorded responses, schema, and active
   channel-specific commands. Removing incomplete authorization at its
   entry point narrows the remaining mutation surface.
   [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

An immediate retirement may require external scripts to stop sending old
submissions. Keeping the URL gives those scripts a precise terminal result.
Deleting the URL entirely would return a generic routing error. A supported
compatibility writer would keep external automation working, at the cost of
new issuance evidence, persisted replay semantics, and a longer transition.

## Verification

Exercise repeated requests and the existing authentication boundary through
the HTTP router. Confirm fixed status, cache policy and JSON, zero domain
lookups, and unchanged stored responses and History in isolated PostgreSQL.
Verify the existing question and settings routes and current pending-decision
path. Run fresh backend coverage and affected quality gates.
