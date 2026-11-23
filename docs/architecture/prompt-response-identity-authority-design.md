# Exact History identity and write authority for prompts

November 23, 2026 Eastern. This follows the
[legacy clarification retirement](legacy-http-clarification-retirement-outcome.md).

## Caller and authority audit

The current client exposes a prompt-response adapter. Astra found its tests
and no bundled operator or CLI caller. The transactional prompt response
contract is present in tagged beta releases from `v0.49.0-beta` through
`v0.49.4-beta` and documented in the earlier
[prompt persistence outcome](prompt-pattern-persistence-outcome.md).
External integrations may still depend on it. The Command Center uses its
separate pending-decision contract.

Prompt detail and response routes currently use the shared integer parser,
which accepts noncanonical forms and can round large History IDs. The
response transaction locks the pending History row and current policy and
library records, applies explicitly requested eligible patterns, and saves
feedback, statistics, the source receipt, and History completion atomically.
The route currently requires authentication. The application requires an
admin for other History decisions and direct pattern administration. Even a
pattern-free prompt response completes a History decision.

## Recommendation and tradeoffs

1. Require the existing administrator middleware on the prompt response POST,
   before identifier validation or a domain operation. Keep list, batch, and
   detail reads available to authenticated users. Preserve the current bearer,
   cookie, scoped-token, and CSRF boundaries. This aligns the composite
   mutation with its privileges. External write callers using ordinary user
   sessions will receive `403`. [OWASP function-level authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/)
2. Validate the decoded History ID once at each HTTP entry point with the
   existing positive BIGINT normalizer. Use canonical decimal text in the
   client URL and preserve the original safe JSON numeric shapes. IDs above
   JavaScript's safe range stay as exact decimal strings through the SQL
   binding, receipt, and response. Existing destination and policy IDs retain
   their narrower INTEGER contract. Strict admission rejects alternate
   spellings at the cost of requiring clients to send the canonical ID.
   Treating the URL segment as an exact reference follows W3C identifier
   guidance by analogy. [PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html),
   [I-JSON numeric interoperability](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2),
   [W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity)
3. Keep the existing transaction, pending eligibility, pattern and native
   intent guards, feedback snapshots, and conflict and replay responses.
   Reusing the transaction preserves external integrations and avoids
   partial writes. The admin-only operation retains its existing power to
   approve explicit eligible legacy patterns. The separate suggestion
   application endpoint merits an independent authority review.
   [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

Retirement would remove the mutation surface and break integrations that still
need this distinct feedback and pattern operation. Widening the IDs alone
would preserve non-admin callers and extend a mutation with inconsistent role
requirements. The recommended combination keeps the endpoint for authorized
clients and applies the established role boundary before widening identity.

## Verification

Use the real prompt router for role and input controls. Verify anonymous and
non-admin refusal and prove authenticated read and administrator write access.
Check large and adjacent IDs, the signed BIGINT maximum, invalid text, client
wire IDs, response types, and exact History, feedback, and receipt linkage.
Run isolated PostgreSQL transaction, concurrent response, replay, and native
intent checks, then fresh affected coverage and normal repository gates.
