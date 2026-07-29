# Policy Library-Rebuild Replacement-Gate Verification Binding

## Status

Implemented for Phase 6R.6 Task 6R.6.6.

This record defines the server-only authorization boundary between a persisted
library-rebuild execution gate and the immutable migration-verification receipt
that authorized its rollback snapshot. It does not rerun verification, call a
provider, read quota state, route media outside the replacement transaction,
expose a browser/API control, or retain raw samples or differences.

## Problem

The original replacement gate accepted a caller-supplied verifier report. Even
when the report was well formed, it was not durable evidence: a stale server
caller or a forged future caller could present a different report than the one
that authorized the rollback snapshot.

The snapshot gate now stores one verification receipt ID and verifier
fingerprint on its execution gate. Replacement must consume exactly that
receipt, rather than choose the latest receipt or accept an in-memory report.

```text
locked execution gate
  + exact receipt ID recorded on that gate
  + exact verifier fingerprint recorded on that gate
  + matching current accepted transition and source provenance
  + zero-difference verifier and zero-issue audits
  -> native replacement transaction
```

Any failed condition stops before native-intent, rule, routing, validation, or
migration-event writes.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default and authorization checks at every request and
  resource boundary. Replacement therefore authorizes from transaction-held
  server records, not request data.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  defines `FOR KEY SHARE` as preventing deletion or key changes to the selected
  row until transaction completion. The gate holds that lock while it validates
  the exact receipt referenced by its `FOR UPDATE` execution gate.
- [Microsoft Well-Architected Safe Deployment Practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small, independent quality gates with clear stop conditions and
  rollback planning. The receipt remains a separate, auditable quality gate;
  replacement does not recompute it while mutating policy state.

## Options Considered

### 1. Continue accepting a caller-supplied verifier report

Pros:

- No receipt query.

Cons:

- Request data can diverge from the receipt that authorized the snapshot.
- A future route, worker, or retry caller could inject a report.
- The migration event cannot prove the authorization evidence it consumed.

### 2. Rerun verification inside replacement

Pros:

- Produces a new comparison immediately before mutation.

Cons:

- Couples bounded comparison work to the write transaction.
- Can select a different evidence set than the snapshot gate used.
- Blurs independent verification, rollback, and replacement responsibilities.

### 3. Read the latest contextual receipt at replacement time

Pros:

- Uses durable server-side data.

Cons:

- A newer receipt might not be the receipt that authorized the snapshot.
- Retry and audit results depend on ordering instead of immutable provenance.

### 4. Lock and revalidate the exact receipt bound to the execution gate

Pros:

- Preserves the authorization chain from verification through replacement.
- Stops safely on missing, stale, mismatched, review-required, risk-blocked,
  or audit-invalid evidence.
- Retains compact, auditable receipt provenance without raw verifier output.

Cons:

- Requires an exact receipt lookup and binding validation at replacement time.

## Final Recommendation Stack

1. Accept only a validated rebuild proposal and accepted transition from the
   caller; ignore any caller-supplied verifier report.
2. In one transaction, lock the policy and execution gate, then accept only
   `snapshot_persisted` or terminal `replacement_applied` state.
3. Lock the receipt by the execution gate's stored foreign-key ID with
   `FOR KEY SHARE`; do not look up the latest receipt.
4. Require the stored receipt ID and verifier fingerprint to agree with the
   locked receipt, then revalidate transition context, acceptance freshness,
   bounded source provenance, no-difference status, and all audit summaries.
5. For a current snapshot gate, stop before native intent, routing, validation,
   and migration-event writes on any receipt failure.
6. Store only receipt ID, verifier fingerprint, and verifier status in the
   replacement migration event. Keep raw samples, differences, actor details,
   and policy payloads out of the event metadata.
7. Return terminal retries only after their bound receipt passes the same
   locked validation; legacy pre-binding terminal records fail closed instead
   of being represented as newly verified replacement authority.

## Implementation Outcome

`server/src/services/policyLibraryRebuildVerificationRunBinding.mjs` now owns
both contextual receipt lookup for the snapshot gate and exact-ID lookup for
the replacement gate. Its replacement helper validates the execution gate's
receipt pair before projecting only the ID, verifier fingerprint, and verifier
status.

`policyLibraryRebuildReplacementGate.mjs` no longer accepts or validates a
`verifierReport` parameter. After the execution gate is locked, it revalidates
the exact persisted receipt before any native replacement write. Missing or
invalid evidence returns `blocked_by_verification_run` with a fixed risk ID.

`policyLibraryRebuildReplacementPersistence.mjs` selects the bound receipt
columns with the execution gate and records compact receipt provenance in the
replacement event. It refuses direct persistence without a structurally valid
receipt projection.

No schema migration is required: the existing execution-gate receipt columns
and foreign key from Task 6R.6.5 provide the durable reference.

## Security Outcome

- Browser and caller data cannot provide replacement verification authority.
- The transaction locks the execution gate before reading its exact receipt;
  parameterized queries use a static table name and a bound receipt ID.
- The receipt must match the same policy, intent, library, accepted-transition
  fingerprint, media type, deterministic source, bounded coverage, and audit
  state that authorized the snapshot.
- Missing pairs, removed receipts, fingerprint mismatches, invalid source
  provenance, nonzero or truncated differences, review-required or risk-blocked
  status, and failed audits stop before policy mutation.
- Replacement events retain no raw media, classifications, verifier samples,
  verifier differences, provider data, quota state, policy payloads, or actor
  identifiers.

## Verification

Focused server tests cover a valid exact receipt lock, missing execution-gate
receipt references, fingerprint mismatch, review-required receipts, caller
report injection being ignored, no native/routing/migration writes on receipt
failure, terminal retry validation, and receipt-only migration-event metadata.

## Next Task

Phase 6R.6 Task 6R.6.7 should be **Library Rebuild Server-Owned Cutover
Orchestration**: compose accepted transition, persisted verification, snapshot,
and replacement only through one server-owned, idempotent workflow. It must
remain browser-free, avoid rerunning any completed receipt, report bounded
stop states, and make legacy deletion remain explicitly disabled until its
separate deletion gate passes.
