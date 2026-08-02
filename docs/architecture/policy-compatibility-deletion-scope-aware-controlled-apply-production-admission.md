# Policy Compatibility Deletion Scope-Aware Controlled-Apply Production Admission

## Status

Complete. Active roadmap ownership is Phase 8R, Task 8R.17.3
Scope-Aware Controlled-Removal Continuation. The former Phase 3R,
Task 3R.10.19 label is retained only as historical source traceability.

## Decision

Production admission is a server-only ESM composition adapter, not a router or
generic mutation endpoint. It receives an Express request only to derive the
actor from the existing `authenticateToken` and `requireAdmin` middleware
contract: `req.user.id` and the exact `admin` role. It ignores API keys, request
body actors, review context, dry runs, replays, clocks, paths, lock results, and
dependency substitutes.

The adapter creates the bounded authorization store, source writer, and apply
adapter from fixed server configuration. It obtains review context only from an
injected server-owned provider, and adapts the existing
`withSessionAdvisoryLock` database service to the scoped lock interface. No
route is registered in this task.

## Problem

The controlled-apply component intentionally accepts dependencies so it can be
tested. Exposing that factory directly to a route would allow an implementation
mistake to treat a request body as an actor, clock, reviewed evidence, or lock
result. A process-local lock also would not serialize mutations across multiple
Classifarr instances. Production needs a narrow composition boundary that fixes
those dependencies and derives security-relevant state on the server.

## Research

OWASP requires authorization to be enforced server-side, re-derived from trusted
state, bound to the operation, and checked immediately before execution. It also
recommends testing authorization logic and denying by default. PostgreSQL
documents advisory locks as application-defined locks; conflicting locks return
false for the non-blocking form, while session locks must be explicitly released
or are released when the session ends. This adapter uses the existing wrapper's
`try`/`finally` release behavior and treats lock unavailability as a fail-closed
result. These sources were current guidance as of June 2026.

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/16/explicit-locking.html)

## Options Considered

### Call Controlled Apply Directly From A Route

Pros: minimal code and a short request path.

Cons: makes it too easy to accidentally accept an actor, review object, clock,
or dependency from request input. It also encourages a broad source-mutation
endpoint. Rejected.

### Use A Process-Local Scoped Lock

Pros: no database dependency and simple unit tests.

Cons: cannot serialize work between application processes or containers.
Rejected.

### Server-Owned Admission Composer With Database Lock

Pros: reuses the existing authenticated-user and advisory-lock boundaries,
keeps configuration explicit, accepts only the authorization ID at apply time,
and does not create an endpoint. Selected.

Cons: requires a database connection and an explicit external evidence root.
It also requires a later server-owned review-context registry rather than a
request-provided review payload.

## Final Recommendation Stack

1. Invoke this adapter only after existing `authenticateToken` and `requireAdmin`
   middleware. Derive the actor exclusively from `req.user.id` and exact
   `req.user.role === 'admin'`; deny missing, non-admin, and API-key-only state.
2. Require absolute `POLICY_COMPATIBILITY_NAMED_SCOPE_REPOSITORY_ROOT` and
   `POLICY_COMPATIBILITY_NAMED_SCOPE_EVIDENCE_ROOT` configuration values. The
   lower operation store rejects an evidence root equal to or inside the source
   repository. Bound authorization TTL to one second through thirty minutes,
   with a five-minute default.
3. Obtain the review context through a server-owned provider with no request
   arguments. Do not accept a review artifact, replay, dry run, file path, or
   scope identity in an issue request.
4. Derive a deterministic negative 32-bit advisory key from the named-scope
   SHA-256 digest. Negative keys avoid the existing positive static lock IDs;
   a hash collision only serializes unrelated work and cannot widen a mutation.
5. Use the existing `withSessionAdvisoryLock` wrapper. Preserve the callback
   result only when the lock is acquired; return the controlled-apply lock block
   without consuming authorization otherwise.
6. Keep the component unregistered. A later explicit registry and narrowly
   reviewed server workflow may call it, but this task adds no client endpoint,
   generic source operation, Git command, file deletion, or browser control.

## Implementation Outcome

`policyControlledCompatibilityNamedScopeRemovalProductionAdmission.mjs` fixes
all collaborators at construction time. `issue()` accepts only an authenticated
request and obtains its review context from the provider; `apply()` accepts only
an authenticated request and authorization ID. Both return concise versioned
results and do not disclose source text or the actor.

`policyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock.mjs` adapts
the existing PostgreSQL session-lock wrapper. The adapter does not invent a
second lock mechanism. `policyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfig.mjs`
parses the three explicit environment values and fails closed before composing
an environment-backed adapter.

## Security Invariants

- Only an existing trusted authenticated-user principal with exact `admin` role
  can issue or apply authorization; `req.apiKey` alone is deliberately refused.
- Request-supplied actor, review context, clock, replay, dry run, root, lock,
  and collaborator values are ignored.
- Database lock loss reaches the controlled-apply adapter as `blocked_by_lock`
  before authorization consumption or source mutation.
- Production configuration requires absolute roots and a bounded TTL. The
  repository-external and non-symlink evidence constraints remain enforced by
  the operation store before it writes any evidence.
- The service is routerless. It creates no HTTP surface and cannot become a
  generic source mutation operation by configuration alone.

## Validation

Focused tests cover authenticated actor derivation, ignored request substitutes,
successful database-scoped apply, missing/non-admin/API-key-only rejection before
review or lock access, unavailable server review context, unavailable database
lock without authorization consumption, deterministic negative lock keys, and
missing or invalid environment configuration. The existing named-scope
controlled-removal regression suite remains green.

## Next Task

Phase 8R, Task 8R.17.3: Compatibility Deletion Scope-Aware Server Review
Context Registry. Create a durable, server-only registry that stores only a
validated accepted review context and exposes a no-request-input provider for
the production-admission composer. It must use opaque server-issued references,
preserve exact review artifact and scope provenance, expire or invalidate
records on source/gate drift, and never return source text, dry runs, or a
generic mutation handle.
