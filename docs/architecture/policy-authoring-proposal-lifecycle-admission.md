# Policy Authoring Proposal Lifecycle Admission

## Status

Implemented by Phase 5R.2a. This record defines the server-owned proposal and
admission boundary that the Phase 4R library lifecycle UI will consume. It does
not make the existing direct native-create route a normal user journey; Phase
4R.8 will remove that compatibility entry after the replacement flow is proven.

## Problem

The earlier native-intent create contract verifies an administrator and an
idempotency key, but it still accepts a browser-assembled `declared_intent`.
That is appropriate only as a compatibility bridge. It cannot safely establish
that the values were derived from the current library evidence, that the
library still has no policy, or that a previously displayed proposal remains
current.

The canonical candidate is specifically built with
`policyLibraryProfileInitialIntent.mjs`, which converts a current stored
library profile into validated native `declared_intent` rules. The existing
library-intent proposal service remains a display/evidence model; it is not a
create credential. Admission means an administrator accepts the server-derived
canonical rules, not that the browser submitted its own rule assembly.

The normal flow needs to be automatic when evidence is sufficient, restrained
when it is not, and resilient to double-clicks, concurrent administrators, and
lost responses. It must not turn observed library contents into an unbounded
browser form or expose raw profile data in a create response.

## Research

- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires server-side authorization for every endpoint, allow-listed input,
  explicit workflow-state validation, identifiers bound to their workflow
  stage, and generic failure responses. It also recommends `429` for rate
  limiting and `201` for resource creation.
- The [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating permissions on every request with least privilege and
  default deny behavior.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines conditional
  request handling such as `If-Match` for preventing lost updates. This
  operation uses a required proposal revision in its bounded JSON command
  because the resource is an action-specific proposal rather than a stable
  representation with an exposed ETag. The server applies the same essential
  rule: it compares the revision before any mutation.
- PostgreSQL documents that row and transaction-level advisory locks release
  when their transaction ends. The implementation locks the proposal, library,
  profile, and existing policy rows during admission; the underlying native
  create service also uses a transaction-scoped idempotency advisory lock. The
  existing unique `library_policies.library_id` constraint remains the final
  database invariant.
- [Express error-handling guidance](https://expressjs.com/en/guide/error-handling/)
  supports forwarding asynchronous route failures to centralized error
  handling. Routes convert expected admission failures into bounded application
  errors and do not return database, stack, or evidence details.

The IETF `Idempotency-Key` HTTPAPI draft was considered but is not a current
normative dependency: its last version expired in April 2026. Classifarr keeps
its existing validated `Idempotency-Key` semantics and durable native-create
receipt rather than claiming conformance to an expired draft.

## Options Considered

### Browser-owned create payload

The browser submits selected observed values and a declared intent directly to
the existing create route.

Pros:

- Minimal new server code.
- Flexible editor behavior.

Cons:

- The client can replay stale or unrelated values.
- It makes the browser responsible for evidence, freshness, and workflow
  sequencing.
- It is incompatible with the automation-first product direction.

Rejected.

### Create state during a lifecycle `GET`

The lifecycle reader generates and persists a proposal reference.

Pros:

- One request before admission.

Cons:

- A read request unexpectedly mutates server state and is vulnerable to
  prefetch/retry behavior.
- It mixes lifecycle observation with an administrator’s prepare action.

Rejected.

### Signed self-contained browser token

The server signs a serialized proposal and the browser returns it during
admission.

Pros:

- No proposal table.
- Stateless verification is possible.

Cons:

- Revocation, supersession, auditability, and one-time consumption become
  complicated.
- A signed payload encourages sending more policy or evidence detail to the
  browser than the interface needs.

Rejected.

### Persisted, opaque proposal with reconstruction at admission

The lifecycle reader reports only bounded candidate state. An authorized
prepare action persists an opaque, short-lived proposal record holding the
canonical declared intent and evidence fingerprint. Admission receives only the
reference, revision, an empty allow-listed adjustment list, and a validated
idempotency key. It locks the record, re-derives the proposal from current
server evidence, verifies equivalence, and invokes the existing native create
transaction.

Pros:

- Preserves a safe, automatic default without trusting browser reconstruction.
- Supports expiry, one-time consumption, replay recovery, and audit queries.
- Gives the UI concise lifecycle and outcome identifiers instead of raw errors.
- Keeps policy storage and the existing idempotency receipt as the durable
  authority.

Cons:

- Adds a small proposal persistence table and cleanup responsibility.
- Requires two explicit requests: prepare, then admit.

Selected.

## Contract

### Lifecycle read

`GET /api/policies/operator-workflow/libraries/:libraryId/authoring-lifecycle`
is non-mutating. It returns one bounded state:

- `eligible_to_prepare_proposal`
- `existing_native_policy`
- `existing_compatibility_policy`
- `profile_recovery_required`
- `proposal_unavailable`

No raw library profile, evidence fingerprint, declared intent, or proposal
reference is returned by this read.

### Proposal preparation

`POST /api/policies/operator-workflow/libraries/:libraryId/proposals` requires
an administrator. It rechecks the lifecycle state and, only when eligible,
persists a proposal with a random opaque reference, server-calculated revision,
expiry, canonical declared intent, and a narrow display summary. The response
contains only the reference, revision, expiry, and display-safe summary.

### Proposal admission

`POST /api/policies/operator-workflow/libraries/:libraryId/proposals/:proposalReference/admission`
requires an administrator and the existing `Idempotency-Key` header. Its body
is strictly limited to:

```json
{
  "proposal_revision": "sha256 revision",
  "adjustment_commands": []
}
```

Phase 5R.2a permits no adjustments. A future, separately admitted task may
introduce an allow-listed command without widening this body to arbitrary
intent. Inside one transaction the service locks the proposal and library,
validates actor, expiry, state, revision, current lifecycle, and current
canonical proposal, then calls the established native-intent create service.

Bounded outcome identifiers cover created, replayed, stale, expired, already
created, request in progress, invalid command, unauthorized actor, and
temporary unavailability. The UI recovers from stale, concurrent, or lost
responses by reading lifecycle again, never by blindly resubmitting a proposal.

## Security Controls

- Admin authorization is checked on lifecycle, prepare, and admission routes.
- All external inputs are positive integer, opaque-reference, revision, and
  strict-object allow-lists with bounded lengths.
- The opaque reference is generated with Node's cryptographic random source;
  it is not derived from a library name, user, profile, or policy contents.
- Proposal records bind library, actor, revision, expiry, and one-time state.
- Admission re-derives the proposal and compares evidence and intent before
  mutation. A stored proposal is not sufficient authority by itself.
- A transaction-level advisory lock serializes the admission attempt. The
  database one-policy constraint remains the final concurrency backstop.
- Lifecycle, prepare, and admission responses set `Cache-Control: no-store`;
  prepare/admit endpoints are rate-limited. Responses and structured logs use
  status identifiers and safe identifiers only; no raw evidence, tokens,
  idempotency key, SQL error, or stack is exposed.
- `GET` never writes a proposal record. Browser prefetches and retries cannot
  create mutable workflow state.

## Outcome

Phase 5R.2a supplied the missing server authority for the completed Phase 4R.4
destination proposal card. The normal lifecycle entry retains the selected
library in durable route state, and the card now calls the separate prepare
endpoint, validates its display-safe result, and admits only the opaque
revision-bound proposal without recreating intent logic in Vue. See [Policy
Destination Proposal Card](policy-destination-proposal-card.md).

Phase 4R.4b now consumes this boundary by discarding stale, concurrent, and
interrupted local proposal state, then reading lifecycle rather than offering a
blind retry. See [Policy Authoring Proposal Outcome
Recovery](policy-authoring-proposal-outcome-recovery.md).
