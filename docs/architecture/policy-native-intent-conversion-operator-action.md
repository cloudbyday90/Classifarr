# Policy Native Intent Conversion Operator Action

## Status

Implemented as the temporary administrator-only preview and explicit apply
boundary for moving selected, conversion-ready policies from the compatibility
projection to native policy-intent storage. It remains a recovery path while
Phase 8R.3.2 replaces the normal conversion flow with server-owned automatic
reconciliation.

## Problem

The policy conversion workflow and transaction-gated writer existed, but no
authenticated product boundary could invoke them as a manual operator action.
The post-upgrade service could apply every ready policy under a post-upgrade
audit label, which is not appropriate for a selective administrator action.

Native conversion changes durable authority. It must not run from policy reads,
ordinary saves, release startup, or a client-supplied actor identity.

## Official-Source Research

- [OWASP API Security Top 10: Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  recommends deny-by-default authorization and explicit checks for sensitive
  administrative functions. Both preview and apply require an administrator;
  apply derives the actor from the authenticated request.
- [OWASP API Security Top 10: Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  recommends protecting sensitive workflows from uncontrolled repetition. The
  endpoint has a small, dedicated rate limit and a bounded selection size.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  documents that concurrent behavior must be considered at the transaction
  boundary. Apply re-evaluates readiness from current storage and retains the
  existing transaction-owned authority lock before writes.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents row locking and deadlock considerations. The writer retains its
  deterministic policy-authority locking rather than trusting a preview.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for secure development practices integrated into normal delivery. The
  operator action is modular, test-covered, audited, and separate from
  automatic release work.

## Recommendation

1. Provide a read-only administrator preview of the current bounded migration
   candidate report.
2. Require the administrator to select one to twenty-five policy IDs and enter
   the exact confirmation value `CONVERT_NATIVE_INTENT` before apply.
3. Re-load the policy inputs and rebuild the candidate report and conversion
   plan immediately before writes. Never trust the preview or actor supplied by
   the client.
4. Reuse the existing transactional writer, but derive migration-event
   `actor_type`, actor ID, reason code, and summary from the approved workflow
   action. A manual conversion is recorded as `operator`, not `post_upgrade`.
5. Keep conversion eligibility distinct from routing automation readiness. A
   selected policy can enter native storage with an explicitly `missing`
   routing target; it still cannot automate until routing is configured.
6. Do not register this dialog action as a one-time post-upgrade task. A
   skipped or blocked one-time task would incorrectly look complete and would
   not retry. The replacement is a dedicated, idempotent reconciliation service
   with durable run state, not an unbounded startup write.

## Options Considered

### Automatic Post-Upgrade Conversion

Pros:

- Requires no operator interaction.
- Can convert an entire installation in one release step.

Cons:

- Couples release startup to durable policy-authority writes.
- Cannot communicate a specific administrator actor or selected scope.
- Makes a routing or evidence misunderstanding harder to inspect before write.

### Client-Driven Conversion Payload

Pros:

- Simple UI implementation.
- Can preserve a preview client-side.

Cons:

- A client could submit stale readiness, a forged actor, or unreviewed policy
  state.
- Does not satisfy server-side function-level authorization requirements.

### Server-Recomputed, Explicit Operator Action

Pros:

- Keeps preview side-effect-free and makes apply fresh and atomic.
- Records the true manual actor type and verified account ID.
- Bounds sensitive work to twenty-five selected policies and three attempts per
  IP per fifteen minutes.
- Retains existing rollback snapshots, idempotency, contract validation, and
  authority locks.

Cons:

- Requires an administrator to select and confirm a conversion batch.
- Does not configure routing or make policies automation-ready by itself.

## Final Recommendation Stack

- Operator action service:
  `server/src/services/policyNativeIntentConversionOperatorAction.mjs`
- Administrator routes:
  `GET /api/policies/native-intent-conversions/preview` and
  `POST /api/policies/native-intent-conversions/apply`
- Transactional writer:
  `server/src/services/policyPostUpgradeApplyGate.mjs`
- Current-state candidate report:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`
- Selection-aware dry-run plan:
  `server/src/services/policyPostUpgradeDryRun.mjs`
- Apply-route limiter:
  `policyNativeIntentConversionApplyLimiterConfig`

## Implementation Outcome

- Added a read-only preview that exposes only the existing bounded,
  operator-safe candidate report and the required confirmation value.
- Added an apply action that accepts only selected policy IDs and the exact
  confirmation, derives the actor from the authenticated administrator, and
  rejects duplicate, empty, invalid, over-limit, unknown, or non-ready
  selections before starting a transaction.
- Kept the bounded preview read-only and authenticated without consuming the
  apply-attempt budget; only confirmed conversion writes are rate limited.
- The apply action rebuilds candidate eligibility and the selected conversion
  workflow from current data before calling the transaction-gated writer.
- The writer now maps the approved workflow actor source to the persistent
  migration-event `actor_type`. Manual actions write `operator`; post-upgrade,
  fixture, and maintainer paths retain their respective types.
- No one-time post-upgrade task was added. Phase 8R.3.2 now defines the
  replacement automatic reconciler; until it is implemented, this explicit
  operator action remains the recovery path.

## Security Outcome

- Both routes require an administrator even when the policy router is mounted
  outside the API-level administrator middleware.
- Client-supplied actor IDs and actor sources are ignored.
- The typed confirmation is an intentional friction control, not an authority
  credential; authorization and current-state eligibility remain server-side.
- Preview and rejected requests do not open a write transaction.
- Apply keeps rollback snapshots, migration events, native intent writes, and
  authority locks inside the existing transaction. Failed writes return a
  rollback-safe availability error without raw legacy policy payloads.
- Conversion never removes compatibility paths or marks routing configured.

## Validation

- Focused service tests cover read-only preview, confirmation rejection before
  reads, unknown selection rejection before the transaction, and successful
  manual conversion with `actor_type = operator`.
- Focused route tests cover administrator enforcement, server-derived actor
  identity, and bounded validation errors.

## Product Surface

The temporary administrator-facing maintenance screen is documented in
[Policy Native Intent Conversion Maintenance UI](policy-native-intent-conversion-maintenance-ui.md).
It consumes this preview and apply boundary while remaining separate from normal
policy authoring and runtime automation. Once the reconciler is implemented,
the surface becomes read-only conversion status and bounded blocked reasons.
