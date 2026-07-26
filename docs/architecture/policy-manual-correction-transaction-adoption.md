# Policy Manual Correction Transaction Adoption

## Status

Implemented as Phase 6R.3.3d. `POST /api/classification/corrections` now
commits the manual-correction lifecycle, source-event receipt, compact outcome
projection, and admitted exact-item memory in one database transaction.

## Problem

The previous correction route executed independent updates: it changed
`classification_history`, inserted `classification_corrections`, recorded an
outcome, and then attempted exact-item memory. A later failure could leave a
correction without its outcome or evidence. The route also did not apply the
standard read-write authorization middleware before mutating state.

The generic authorized-outcome executor intentionally cannot infer that every
source should set a classification to `corrected`. Manual correction needs a
source-specific legacy-compatible outcome projection while retaining the shared
authorization, idempotency, and learning boundaries.

## Official Guidance Reviewed

Official sources reviewed July 26, 2026 against the requested June 2026
baseline:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side authorization, controlled state transitions, and a
  final authorization control bound to execution.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating authorization on every request and exiting safely when
  checks fail.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends deriving security-relevant values server-side and rechecking
  object state and ownership for each operation.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  documents that `SELECT ... FOR UPDATE` blocks concurrent modifications until
  the surrounding transaction ends.
- [PostgreSQL Data Consistency Checks at the Application Level](https://www.postgresql.org/docs/17/applevel-consistency.html)
  recommends explicit locking when application-level consistency checks must
  remain valid across concurrent writes.

## Design

```text
authenticated POST /corrections
  -> requireReadWrite
  -> BEGIN
  -> lock classification, then target library
  -> validate active matching-media destination
  -> update corrected classification + insert correction row
  -> derive classification_correction:<row id>
  -> canonical intake + learning guard
  -> revalidate actor from locked state
  -> claim fingerprint-bound receipt
  -> write corrected outcome projection + admitted exact-item memory
  -> COMMIT or ROLLBACK everything
```

`policyManualCorrectionExecutionLifecycle.mjs` owns only the locked legacy
lifecycle transition. `policyManualCorrectionExecutionAuthorization.mjs`
revalidates a bounded authenticated actor context. The transaction service
composes those modules with the generic executor using the same caller-owned
transaction client. `policyManualCorrectionExecutionEffects.mjs` is the
source-specific outcome writer: it preserves `corrected` and `api_correction`
metadata without teaching the generic executor source lifecycle semantics.

The receipt event ID is derived only after the inserted correction row has a
database ID. No request payload can set it. The receipt captures compact
authorized command semantics, not title, provider, AI, Discord, or raw request
content.

## Options Considered

### Keep Independent Route Writes

Pros: smallest immediate patch.

Cons: allows partial writes and preserves a best-effort evidence mutation;
rejected.

### Make the Generic Executor Perform Manual Lifecycle Changes

Pros: one apparent owner for all writes.

Cons: couples shared execution to the meaning of `corrected` and risks
incorrect behavior for confirmation, routing, and future sources; rejected.

### Source-Specific Lifecycle and Outcome Adapter in One Shared Transaction

Pros: atomic correction behavior, server-derived event correlation,
idempotency, reusable authorization, and preserved legacy outcome semantics.

Cons: adds four small focused modules and source-specific tests; selected.

## Final Recommendation Stack

1. Require a read-write authenticated principal at the route boundary.
2. Lock the classification before the destination in a consistent order.
3. Validate the destination from locked persisted state.
4. Derive the source event from the inserted correction row.
5. Build and guard canonical learning intake before durable learning writes.
6. Revalidate authority, claim the receipt, and apply only command-authorized
   operations using the same transaction client.
7. Retain a source-specific compact outcome projection outside the generic
   executor.
8. Roll back the lifecycle, receipt, outcome, and exact-item memory together
   on every failure.

## Security Outcome

- The route accepts no client-provided actor, source-event, outcome, or
  learning authority.
- Unauthenticated, read-only, webhook-only, and integration credentials fail
  at the existing read-write middleware.
- Unknown intake, destination drift, authorization loss, duplicate mismatch,
  unavailable writers, and persistence failures fail closed.
- The logs and receipt retain only bounded decision metadata.

## Verification

Focused service tests cover authenticated actor revalidation, locked lifecycle
validation, source-specific outcome shaping, caller-owned transaction reuse,
and blocked execution rollback. The real correction lifecycle integration
suite verifies corrected state, legacy outcome metadata, guarded exact-item
evidence, and the `manual_classification_change` source-event receipt.

## Next Step

Proceed to **Phase 6R.3.3e: Profile Refresh Command Consumer**. It should add
a durable, idempotent consumer only for command-authorized evidence changes;
exact-item memory remains ineligible to queue a refresh.
