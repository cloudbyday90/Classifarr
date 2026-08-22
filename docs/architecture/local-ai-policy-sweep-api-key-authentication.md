# Local AI Policy Sweep API-Key Authentication and Preflight

Status: Implemented on 2026-08-22. This document records the authentication
hardening for the local policy-to-AI sweep. It does not authorize a deployment,
policy change, media routing, or release.

## Objective

The local sweep can exchange an administrator API key for a short-lived,
least-privilege JWT. An earlier local run observed a token rejection after a
successful exchange. The exchanged JWT later worked in a direct local request,
so the failure was not reproducible as a server-side defect. The operator
experience was nevertheless ambiguous: the harness began its broad preflight
in parallel and reported only the first rejected request.

This change makes the API-key path deterministic and diagnosable without
revealing a key, bearer token, server response body, or raw AI/policy data. It
does not assume that a failed credentialed `POST` can be safely retried.

## Official-Source Research

Research was refreshed on 2026-08-22 against current primary sources.

- [RFC 9700, OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)
  recommends treating access tokens as secrets and restricting their audience
  and privilege to limit replay impact. The sweep continues to use a short
  lifetime, a dedicated audience, explicit method-and-route grants, and no
  refresh token.
- [RFC 8725, JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
  requires issuer validation when an issuer is present, and requires audience
  validation when tokens can be used by more than one relying party. The server
  now pins the issuer and HS256 verification algorithm and rejects a scoped
  token whose audience is not the local-sweep audience.
- [RFC 9110, HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
  says clients should not automatically retry a non-idempotent request unless
  they can determine it was not applied or have an explicit idempotency design.
  The exchange is a credentialed `POST` with audit side effects, so the client
  does not retry it.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  identifies access tokens, session identifiers, passwords, and primary
  secrets as data that should not be recorded directly. The new errors include
  only a stage, method/route, and HTTP status where available; neither module
  logs a credential or response payload.

## Options Considered

### Retry the API-key exchange after a rejected follow-up request

Pros:

- may hide a short-lived local networking failure;
- does not require an operator to rerun the command.

Cons:

- repeats a credentialed non-idempotent `POST` with an audit side effect;
- mints additional bearer tokens during an ambiguous failure;
- makes the observed fault harder to diagnose and increases key use.

Decision: rejected. A new operator invocation intentionally creates a new
authentication attempt after the cause is understood.

### Keep the existing parallel broad preflight

Pros:

- slightly lower startup latency;
- no code extraction required.

Cons:

- a token failure appears as an arbitrary settings, library, history, or policy
  request failure;
- cannot prove that the newly exchanged JWT was accepted before settings writes
  or media submission begin;
- leaves the API-key path hard to regression-test independently.

Decision: rejected.

### Exchange once, then make one read-only scoped-token preflight

Pros:

- establishes an explicit exchange-to-authorized-request contract;
- fails before temporary AI setting changes or media submission;
- adds one inexpensive request and no broad authority;
- produces safe, stage-specific diagnostics without inspecting JWT contents;
- supports a deterministic unit regression over the exact HTTP sequence.

Cons:

- adds one request before the normal preflight;
- a valid token can still expire later in an unusually long sweep, which is
  correctly reported as a later API failure rather than silently re-authenticated.

Decision: selected.

## Design

```text
admin API key
    |
    | POST /api/auth/token/exchange-local-sweep  (exactly once)
    v
short-lived, audience-scoped JWT
    |
    | GET /api/settings/ai  (read-only acceptance preflight)
    v
normal sweep preflight -> guarded settings changes -> local submissions
```

`scripts/lib/localAiPolicySweepAuthentication.mjs` owns the HTTP and
authentication boundary. It provides the bearer API client, password login,
API-key exchange, and the scoped-token preflight as named ESM exports. The
top-level sweep remains responsible for fixture validation, policy evaluation,
temporary setting restoration, model execution, and report output.

The API-key sequence is deliberately serialized:

1. validate fixtures before any authentication;
2. exchange the API key once for the 300-second scoped token;
3. call `GET /api/settings/ai` using only `Authorization: Bearer <token>`;
4. reuse that successful response as the baseline settings preflight; then
5. begin the remaining parallel read-only checks.

The JWT server boundary exports canonical local-sweep `token_use` and
`audience` constants. Token generation and route responses use these constants.
Verification permits only HS256, requires issuer `classifarr`, and verifies the
dedicated audience after signature validation. The route middleware retains its
defense-in-depth audience and method-and-route authorization checks.

## Security Properties

- The API key appears only in the exchange request header. The scoped token
  appears only in the in-memory `Authorization` header for subsequent requests.
- The CLI emits no token, API key, or response body. HTTP failures report only
  request method, route, and status; authentication failures report a bounded
  stage and status.
- The client never retries an exchange. It has no refresh token and does not
  broaden the server's existing allowlisted route grants.
- The first post-exchange call is read-only and occurs before temporary
  configuration writes or media submissions. A rejection fails closed.
- The auth service verifies signed access tokens using an explicit issuer and
  HS256 allowlist. Scoped tokens additionally require the dedicated audience.
- API keys should be supplied through a prompted `CLASSIFARR_API_KEY` value for
  local automation where practical, then removed from the shell environment
  after the run. An inline shell assignment can still create a history entry.

## Verification Outcome

Focused Jest coverage exercises the API-key sequence with injected fetch:

- sends the API key only to the exchange endpoint;
- sends the returned scoped bearer token to the read-only preflight;
- does not forward the API key to the preflight;
- rejects a denied preflight without a second exchange; and
- excludes API-key and server-response text from diagnostics.

Authentication-service tests also assert the explicit JWT verification options
and reject a signature-valid scoped token with the wrong audience. Existing
auth-route and route-allowlist tests confirm that the token still has only the
required exact route grants.

## Final Recommendation Stack

1. Use the API-key exchange only for intentional local automation, with the
   scoped token as the sole credential after exchange.
2. Keep the immediate read-only preflight and do not add automatic retries
   unless the exchange gains a server-enforced idempotency contract.
3. Retain short token lifetimes, audience and route restrictions, explicit
   algorithm and issuer validation, and no refresh-token issuance for sweeps.
4. Keep credentials and raw server errors out of reports, logs, commits,
   command history, and documentation examples.
5. Before a release, rebuild the local Docker compose stack and run the
   API-key path with a replacement administrator key, then run the full release
   gates from the release workflow.

## Next Recommended Item

Add a reviewed trend-baseline comparator for matching fixture, policy, runtime,
and queued-witness fingerprints. It should surface score and outcome deltas for
human review, without changing model routing, policy state, deployment, or
release authority.
