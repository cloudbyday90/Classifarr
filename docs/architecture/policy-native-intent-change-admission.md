# Policy Native Intent Change Admission

## Status

Implemented as Phase 5R Task 5R.10 on August 6, 2026.

## Decision

A persisted native policy may change only through a narrow, revision-bound,
audited, allow-listed server command. The admission contract defines the
command shape, validates it against current authority state, and returns a
bounded outcome. It is pure and side-effect-free: it performs no database
write, no route mutation, no policy persistence, no routing, no learning, and
no provider call. The actual transactional persistence wiring follows the
same two-phase pattern proven by 5R.2 (admission contract) and 5R.2a
(proposal lifecycle service).

The admission replaces the current `POLICY_NATIVE_INTENT_UPDATE_UNSUPPORTED`
throw in `policyIntentWriteAdmission.buildPolicyUpdateWriteAdmission`. Until
this contract admits a change, native updates remain blocked. No generic
legacy policy `PUT` route becomes an implicit native maintenance path.

## Command Shape

The admission accepts one typed command per call:

```text
policyId          positive integer (route-derived, never client-supplied)
expectedRevision  positive integer (current native authority intent_version)
actorId           positive integer (authenticated administrator)
actorRole         must be 'admin'
idempotencyKey    opaque string (header-derived, same format as create)
changeCommands    array of allow-listed, typed change operations
```

Each change command is one of:

| Command ID | What it changes |
| --- | --- |
| `update_purpose` | Replace the belongs-here purpose rule set |
| `update_hard_limits` | Replace declared hard-limit constraints |
| `update_avoid_rules` | Replace declared avoid values |
| `update_helpful_matches` | Replace declared helpful-match signals |
| `update_routing_target` | Replace the routing target reference |
| `update_review_triggers` | Replace the review-trigger configuration |

A browser-synthesized compatibility projection (legacy `customSignals`,
preset weights, thresholds, combination mode) is explicitly rejected. The
admission does not accept a generic policy `PUT` body.

## Outcome Mapping

| Outcome | When | Client action |
| --- | --- | --- |
| `admitted` | Actor authorized, revision matches, commands valid, authority active | Proceed to persistence |
| `stale_revision` | Expected revision does not match current `intent_version` | Reload and retry |
| `policy_replaced` | A newer intent version is already active | Reload lifecycle |
| `recovery_required` | Authority is ambiguous, non-authoritative, or missing purpose | Resolve maintenance blocker |
| `authorization_rejected` | Actor is not an administrator | Deny request |
| `unavailable_authority` | No active native intent exists for this policy | Use create path or resolve |
| `unknown_command` | Change command ID is not in the allow-list | Reject request |
| `retryable` | Transient validation issue (empty command set, malformed payload) | Fix and retry |

## Revision Checking

The admission uses optimistic concurrency control:

1. The client reads the current native authority projection and receives the
   `intent_version` (an incrementing revision number).
2. The client sends `expectedRevision` matching that version.
3. The admission compares `expectedRevision` against `currentRevision`
   supplied by the caller (derived from the locked database row inside the
   transaction).
4. A mismatch produces `stale_revision`. The client must reload the current
   authority projection and retry.

This follows the [ETag/If-Match pattern](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
recommended for HTTP optimistic concurrency: the server returns a version
token on read, the client sends it back on write, and the server rejects if
the version has changed. The admission uses an integer revision rather than
a hash-based ETag because the native intent table already carries
`intent_version` as a monotonic integer.

## Legacy Route Isolation

The admission explicitly rejects any payload that contains:

- `native_intent_establishment` (create-time field, not a change field)
- `customSignals`, `signals`, `presetWeights`, `decisionThreshold`
- Raw `configuration_view` or compatibility bridge fields
- Any field not in the allow-listed change-command set

This prevents a legacy update route from smuggling native establishment or
browser-synthesized compatibility projections through the change path.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization, least privilege, and automated
  tests of access-control logic. The admission requires an authenticated
  administrator, rejects unknown commands, and fails closed on missing
  authority.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at non-public endpoints and warns against relying
  on client-provided state. The admission derives `policyId` from the route,
  `actorId` from the session, and rejects browser-synthesized projections.
- [MDN ETag Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
  and [RFC 9110 Conditional Requests](https://www.rfc-editor.org/rfc/rfc9110#name-preconditions)
  define the standard HTTP optimistic concurrency model. The admission uses
  the same read-version → send-version → compare-and-reject pattern.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf) requires traceable,
  auditable software changes. The admission records actor, revision,
  commands, and outcome for audit provenance.

## Options Considered

### 1. Generic native policy PUT endpoint

Pros:

- Simple to implement.
- Matches RESTful update conventions.

Cons:

- Accepts arbitrary fields, making it easy to smuggle compatibility data.
- Does not enforce revision checking or allow-listed commands.
- Violates the roadmap rule: "Do not expose a generic policy PUT."

### 2. Extend the proposal lifecycle to handle updates

Pros:

- Reuses the existing proposal/admission two-phase flow.

Cons:

- The proposal lifecycle is designed for CREATE from observed evidence, not
  for persisted-policy maintenance. Extending it would conflate two distinct
  authority boundaries.
- A maintenance change does not need a library-profile-derived proposal; it
  needs a revision-bound command against the existing intent.

### 3. Build a dedicated, pure admission contract now; wire persistence later

Pros:

- Defines the exact command shape, revision semantics, and outcome mapping
  before any SQL is written.
- Follows the proven 5R.2 pattern (admission contract → later persistence).
- Can be fully tested without a database.
- Blocks native updates safely until the persistence path is wired.

Cons:

- Does not immediately enable persisted native changes (requires follow-up
  persistence wiring).
- Adds one more contract to maintain.

### 4. Wait until 4R.7 needs it

Pros:

- No work until the UI demands it.

Cons:

- Leaves the `POLICY_NATIVE_INTENT_UPDATE_UNSUPPORTED` throw as the only
  gate, with no regression-tested contract defining what a valid change
  looks like.
- Does not satisfy the roadmap's explicit task definition or the Phase 5R
  dependency chain.

## Final Recommendation Stack

1. Build a pure, side-effect-free admission contract that defines the narrow
   change command, revision checking, allow-listed operations, outcome
   mapping, and legacy route isolation.
2. Require an authenticated administrator actor and a positive-integer
   policy identifier derived from the route, not the client body.
3. Use optimistic concurrency: compare `expectedRevision` against
   `currentRevision`; produce `stale_revision` on mismatch.
4. Allow-list six typed change commands (purpose, hard limits, avoid,
   helpful matches, routing target, review triggers).
5. Explicitly reject browser-synthesized compatibility projections and
   native establishment fields.
6. Return bounded outcomes for success, stale revision, policy replaced,
   recovery required, authorization rejected, unavailable authority,
   unknown command, and retryable.
7. Preserve idempotent replay semantics via the same idempotency-key format
   as the create path.
8. Self-validate like the existing admission contracts: reject side effects,
   version mismatch, and ready-status inconsistency.

## Implementation Outcome

`server/src/services/policyNativeIntentChangeAdmission.mjs` owns the
admission contract. It defines the six allowed change-command IDs, eight
outcome status IDs, revision comparison, actor authorization, command
validation, legacy field rejection, and a self-validating result envelope.

The admission is pure: it takes the current authority state and the change
request as inputs and returns a bounded admission result. It performs no
database query, no transaction, no route mutation, and no persistence. A
future persistence service will consume the admitted command inside a
transactional boundary that locks the authority row, rechecks the revision,
and applies the change atomically — following the same pattern as
`policyNativeIntentReversionService`.

Focused regression tests cover:
- admitted change with valid revision and commands
- stale revision mismatch
- authorization rejection for non-admin actor
- unavailable authority when no active native intent exists
- recovery required for ambiguous or non-authoritative authority
- unknown command rejection
- legacy field smuggling rejection
- empty command set retryable outcome
- idempotency key validation
- side-effect rejection and self-validation

## Security Outcome

- A persisted native policy can change only through a revision-bound,
  audited, allow-listed server command.
- A stale or competing edit cannot overwrite a newer policy state.
- Legacy update routes cannot smuggle native establishment or compatibility
  projections through the change path.
- The admission fails closed on missing authority, ambiguous authority, or
  unauthorized actors.
- No raw payloads, request bodies, or persistence internals are disclosed in
  the outcome.

## Next Task

Phase 5R is now complete (5R.1 through 5R.10). The next work is **4R.6
Material Exception Controls**, which can now proceed because all runtime
trust authority contracts are in place.
