# Policy suggestion application authority

November 23, 2026 Eastern. This follows the
[prompt response authority change](prompt-response-identity-authority-outcome.md).

## Findings

`POST /api/suggestions/:id/apply` and
`POST /api/feedback/suggestions/:id/apply` both call the same policy writer.
The writer locks the pending suggestion and its policy, checks evidence and
policy authority, then applies the stored threshold, weight, or eligible
pattern change and records the actor. Astra confirmed that the dashboard
uses the first route. The similarly named Library Detail action uses its
own library-rule endpoint.

Both application routes currently require authentication alone. Direct
policy edits already require an administrator. The suggestions route
passes the raw path and supplies actor `1` when the session has no ID. The
feedback route takes the session actor and parses a numeric prefix. The
suggestion and actor columns use PostgreSQL `INTEGER`.

## Recommendation and tradeoffs

1. Apply the existing administrator middleware to the two apply handlers
   before input validation or a database operation. Require a valid actor
   from the authenticated session. Ordinary authenticated accounts receive
   `403` for these writes. Keep current read and reject access, including
   the compatibility alias, and use the existing authentication and scope
   checks. Protecting both entry points prevents the authorization rule
   from depending on which URL a caller chooses.
   [OWASP function-level authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/)
2. Use the existing positive `INTEGER` parser at the shared command
   boundary. Admit canonical decimal IDs through `2147483647` and give
   a fixed `400` response for other decoded IDs. Check the same range in
   the client adapter before constructing the URL. Preserve the primary
   route's nested string `suggestionId` and the feedback route's flat
   numeric `suggestionId`. External callers that relied on alternate
   spellings need to send the canonical ID.
   [PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html),
   [W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity)
3. Keep the transactional writer and its evidence, policy, lifecycle and
   conflict rules. Show fixed administrator guidance when Apply returns
   an administrator-role or actor-identity refusal on the dashboard. Keeping
   the shared dashboard avoids a new role
   request or a broader page restriction. Its Apply controls remain visible
   to members, and the server makes the role decision. The guidance follows
   the W3C principle of explaining the user's available next step.
   [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html),
   [W3C WCAG error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)

Protecting the entire router would also block current readers and reviewers.
Retiring the feedback alias would break administrator integrations with no
additional authorization benefit once both routes enforce the same rule.

## Verification

Exercise both production routers with authenticated and anonymous HTTP
requests in isolated PostgreSQL. Verify authorization before input
validation, exact boundaries, applied actor, response shape, current
conflicts and cross-alias replay refusal. Preserve evidence, locking and
rollback coverage. Test the client adapter's exact URLs and the dashboard's
administrator guidance, then run fresh affected coverage and the normal
quality gates. Check for open PRs at delivery.
