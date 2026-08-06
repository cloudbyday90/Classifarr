# Policy Migration Verification Boundary

## Status

Implemented.

This document records the retained migration-verification boundary that keeps
cutover safety checks outside ordinary policy authoring. It is a server-only
guard for the temporary migration path, not a new policy workflow, API, UI
control, scheduler, provider integration, or quota mechanism.

## Decision

Migration verification may be invoked only by the library-rebuild cutover
orchestrator and only with a fixed server-owned tuple:

```text
accepted rebuild proposal
  + accepted rebuild transition
  + valid server evaluation time
  -> bounded source read and audited comparison
  -> idempotent verification receipt or a compact stop result
```

The invocation boundary rejects a missing or mismatched scope, unknown input
fields, non-plain proposal or transition values, non-`Date` evaluation times,
and values that cannot be safely cloned. Rejection happens before coordinator
work, database reads, or receipt persistence.

The receipt handoff then revalidates a ready coordinator result against the
fixed receipt schema before it opens its transaction. A malformed source
summary or verifier fingerprint therefore cannot reach the repository claim.

## Boundary Topology

The source topology audit treats these imports as the complete retained path:

| Component | Allowed importer(s) | Allowed behavior |
| --- | --- | --- |
| Verification coordinator | Verification-run handoff | Bounded source read and pure comparison coordination |
| Verification-run handoff | Rebuild cutover orchestrator | Admit, audit, and persist/replay one receipt |
| Verification-run repository | Verification-run handoff | Parameterized idempotent receipt claim/read |
| Rebuild verification binding | Snapshot and replacement gates | Shared-lock, bounded receipt validation |

Any additional server importer fails the audit. A route importer fails with a
specific risk because it would expose this migration-only path to normal policy
authoring. The audit is a regression guard, not a substitute for endpoint
authorization: no route is added, and any future endpoint must independently
perform authentication and authorization.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization, least privilege, and automated
  tests of access-control logic. The fixed invocation scope and source-topology
  test apply those principles within the retained server module graph.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at non-public endpoints and specifically addresses
  preventing out-of-order execution. Keeping migration verification off routes
  and requiring an accepted transition prevents a browser request from
  bypassing the cutover sequence.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends treating cross-trust-zone data as untrusted and retaining only
  necessary, protected event data. The receipt is a compact fingerprint/count
  record, with no raw samples, media metadata, provider data, or policy
  payload.
- [PostgreSQL `INSERT` documentation](https://www.postgresql.org/docs/current/sql-insert.html)
  documents `ON CONFLICT` as the database-supported conflict path. The
  repository keeps its server-derived idempotency key and exact replay check,
  rather than treating any duplicate as success.

## Options Considered

### 1. Leave the handoff as a general internal function

Pros:

- No new boundary module.
- Convenient for ad hoc server callers.

Cons:

- Accepts arbitrary option fields and makes accidental authoring reuse easy.
- Does not express the single intended owner or reject scope mismatch.
- Defers malformed receipt detection to deeper layers.

### 2. Add a privileged browser or administrator endpoint

Pros:

- Makes manual migration diagnostics easy to invoke.

Cons:

- Reintroduces the diagnostic product surface that the cutline removed.
- Requires a new authorization, rate-limit, input-validation, and audit-log
  surface.
- Lets an operator attempt cutover work out of sequence.

### 3. Factory-bound invocation scope plus a fixed, cloned input tuple

Pros:

- Makes the intended server owner explicit and default-denies other callers.
- Rejects unknown controls before read or write work begins.
- Keeps the coordinator API small and preserves a compact receipt boundary.
- Is simple to test without adding public infrastructure.

Cons:

- Requires intentional contract updates when the cutover needs another input.
- Is an in-process boundary, so route authorization remains mandatory if a
  future endpoint is ever proposed.

### 4. Move the verifier to a separate worker with database roles

Pros:

- Strong process and credential isolation.

Cons:

- Adds deployment, queue, retry, and credential complexity for a retained
  migration-only component.
- Is disproportionate until the verifier is proven to be a permanent runtime
  capability.

## Final Recommendation Stack

1. Keep migration verification server-only with no route, client API, browser
   control, scheduler trigger, provider call, or quota interaction.
2. Bind the handoff factory to the rebuild cutover scope and reject every other
   scope by default.
3. Admit only proposal, accepted transition, and valid server `Date`; reject
   all unknown fields and clone the accepted tuple before coordination.
4. Revalidate ready coordinator data against the exact receipt schema before a
   transaction, then perform only the idempotent receipt claim.
5. Preserve the existing source limits, provenance audit, fingerprint checks,
   stale-receipt binding, and conflict-versus-replay distinction.
6. Run the source-topology audit in regression coverage so an importer cannot
   silently expose a retained component to authoring or another workflow.
7. Reassess the retained verifier only after migration parity and native
   storage cutover evidence exist; delete it unless a bounded runtime-evidence
   role is explicitly accepted.

## Implementation Outcome

`server/src/services/policyMigrationVerificationInvocationBoundary.mjs` owns
the allowed scope, fixed tuple admission, deep clone, compact risks, and
side-effect declaration. It performs no read, write, routing, learning,
provider, or scheduler operation.

`server/src/services/policyMigrationVerificationRunHandoff.mjs` binds the
boundary to the cutover factory, passes only admitted input to the coordinator,
and returns `boundary_rejected` without calling the coordinator or transaction
when admission fails. For a ready coordinator result it validates the compact
receipt record before entering the existing transaction boundary.

`server/src/services/policyMigrationVerificationBoundaryAudit.mjs` checks the
server source import graph for the coordinator, handoff, repository, and
binding. It fails closed for missing expected owners, unexpected importers, and
route imports. It is test-only verification infrastructure and is not invoked
by normal application workflows.

Focused regression tests cover invalid accepted transitions, scope mismatch,
unexpected invocation fields, source audit failure, malformed fingerprint,
stale receipt, receipt conflict, and a synthetic unsafe route import. All
failures occur without policy, routing, learning, provider, scheduler, or
browser work.

## Next Task

The next item in this stream is **5R.8.4 Final Verifier Deletion Or Promotion
Gate**. It requires proven migration parity, completed native-storage cutover,
expired rollback retention, and no active rebuild binding before any retained
verifier artifact is deleted or promoted. The generated-intent outcome reducer
(5R.8.3) is resolved as migration-only and will be deleted with the verifier
chain at that gate; see
[Policy Runtime Evidence Reducer Resolution](policy-runtime-evidence-reducer-resolution.md).
