# Policy Constraint Write Admission

Status: implemented as the server-side, non-persistent admission boundary for
future native constraint storage.

## Scope

`policy.constraint_write_admission_request.v1` is the only request DTO that a
future native constraint writer may use to present one typed local constraint
command. It accepts the existing command fields only, rejects every additional
property, requires a session-derived authenticated administrator, and receives
the target library identity from the route rather than the request body.

For every request, the server independently rebuilds:

- `policy.constraint_decision_model.v1`, which defines the control command,
  intent, effect, and certification semantics; and
- `policy.constraint_value_eligibility.v1`, which defines the active
  library's canonical allowable values.

The submitted command must match both server-derived projections exactly. The
admission result exposes only the server-normalized command and a bounded
library media-type family. It does not expose raw request input, cached profile
evidence, media paths, provider data, a reusable authorization credential, or
a normal-workflow next action.

This component does not write native or legacy policy storage, mutate learning,
evaluate runtime policy, route media, read a provider quota, or call a media
server. It is also deliberately not a time-of-check substitute for a future
write: the future native storage transaction must repeat admission against its
then-current library context before it persists anything.

The protected endpoint is:

`POST /api/policies/operator-workflow/libraries/:libraryId/constraints/admission`

No current client authoring flow calls this endpoint. The local draft remains
transient until native constraint storage is designed and implemented.

Admission is deliberately excluded from the six-state policy-authoring
readiness contract. It does not add a readiness state, issue, action, or UI
message because it has not persisted or changed policy intent.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires sensitive transaction authorization and its final execution gate to
  be enforced on the server, with server-generated and verified data.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side, allowlist-based validation, normalization, bounded
  values, and strict handling of structured input.
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
  recommends DTOs that expose only explicitly bindable, non-sensitive fields.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires endpoint-level access control and server-validated workflow state,
  rather than relying on client sequencing.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports small, testable security boundaries that reduce the impact of
  defects before release.
- [RFC 9457, Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
  distinguishes useful client-correctable interface errors from implementation
  debugging details. This task retains Classifarr's established error envelope
  rather than introducing a second API error format.

## Recommendations

1. Accept only a versioned, strict DTO containing the typed local command. Do
   not bind a client-supplied policy ID, library ID, actor, decision model,
   eligibility projection, persistence mode, or routing target.
2. Obtain the target library from the route and the operator identity from the
   authenticated session. Require a positive administrator identity even
   though the parent policy router is already admin-protected.
3. Rebuild and audit decision semantics and value eligibility at the server
   boundary. Compare every command semantic field and the one selected value
   against those projections; do not trust a browser copy of either.
4. Return the server-derived command only when it is admitted. Do not return a
   durable token, a database identifier, or any claim that storage, runtime,
   learning, or routing has happened.
5. Rate limit the endpoint, log only library ID, status, control ID, and risk
   code, and avoid logging submitted values or full request payloads.
6. Require the eventual storage service to perform the same checks within its
   write transaction. Admission is an interface boundary, not a bypass for
   workflow ordering or a time-of-check/time-of-use guard.
7. Do not expose a normal-workflow next action from admission. Readiness must
   remain based on observed examples, declared intent, routing, hard limits,
   and profile freshness; a preflight result is not one of those inputs.

## Pros And Cons

### Strict Server-Revalidated DTO

Pros:

- Blocks parameter injection, field escalation, and client-side semantic
  remapping before a future write service sees a command.
- Keeps hard-limit, avoid, and review-warning meanings tied to the canonical
  server vocabulary and active library media type.
- Is immediately testable without a media server, provider, quota, or policy
  storage migration.

Cons:

- A later storage contract must deliberately repeat the revalidation instead
  of treating this admission response as durable authority.
- Adding a new constraint control requires an intentional DTO and
  server-projection compatibility update.

### Non-Persistent Admission Endpoint

Pros:

- Establishes a complete, authenticated boundary before a database migration
  expands the blast radius.
- Gives future callers a safe failure mode when a library type, value, or
  command semantic is no longer current.
- Preserves the hands-off normal workflow because this endpoint adds no
  additional operator interaction or configuration.

Cons:

- It is not yet user-visible functionality because no native constraint
  storage exists.
- The endpoint performs a small library read for each admission request.

## Final Recommendation Stack

- `server/src/services/policyConstraintWriteAdmission.mjs`
  - Rebuilds decision and eligibility projections, rederives the admitted
    command, and audits the no-write admission result.
- `server/src/services/policyConstraintWriteAdmissionContract.mjs`
  - Defines the strict request DTO, session-actor and library normalization,
    bounded result shape, and explicit no-write authority declaration.
- `server/src/routes/policiesRoutePolicyConstraintAdmission.mjs`
  - Loads only the route-selected library, applies the rate limit, rejects
    non-admin callers, prevents malformed input from reaching the database,
    and maps safe rejection states to existing HTTP errors.
- `server/src/services/policyConstraintDecisionModel.mjs`
  - Remains the authoritative source of each command's control semantics.
- `server/src/services/policyConstraintValueEligibility.mjs`
  - Remains the authoritative per-library allowlist of certification and
    review-warning values.
- `server/src/routes/policyOperatorWorkflowRouteContext.mjs`
  - Provides the bounded active-library read used by both workflow views and
    this admission route.
- A future native constraint storage service must recompute admission in the
  same transaction that persists its own native record. It must not accept an
  earlier admission response as a write credential.
- The admission response intentionally has no `nextStep` field. Its contract
  audit rejects any attempt to add a normal-workflow handoff.

## Verification

- `server/src/__tests__/services/policyConstraintWriteAdmission.test.mjs`
  verifies explicit administrator requirements, strict DTO rejection,
  server-derived semantic comparison, active media-type eligibility, no-write
  side-effect claims, and audit failure detection.
- `server/src/__tests__/policies-constraint-admission-routes.test.mjs`
  verifies endpoint rate limiting, library-only data access, safe request
  rejection before database reads, no-value logs, no-storage admission, and
  route-local administrator enforcement.
- Existing workflow-read and custom intent-signal route tests confirm the
  shared library-context refactor remains behaviorally compatible.

## Outcome

The platform now has an authenticated, server-owned constraint-command
admission boundary. It closes the gap between transient client drafts and a
future native write without creating a parallel legacy path, schema migration,
runtime behavior, or manual operator task.

## Next Step

Design native constraint persistence as a separate transactional boundary. It
must repeat admission against current state, persist atomically, and only then
allow normal readiness to recompute from durable policy intent.
