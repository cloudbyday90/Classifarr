# Policy Native Intent Change Persistence Wiring

## Status

Implemented as 5R.10 persistence wiring on August 7, 2026.

## Decision

The pure `policyNativeIntentChangeAdmission.mjs` contract (5R.10 admission)
is now connected to a transactional persistence service, a parameterized
persistence layer, and an administrator-only HTTP route. The full chain is:

```text
POST /api/policies/:id/native-intent/changes
  -> route handler (admin auth, actor derivation)
  -> applyPolicyNativeIntentChange (service)
    -> buildPolicyNativeIntentChangeAdmission (pure validation)
    -> if not admitted: return bounded result (no DB hit)
    -> dbClient.withTransaction:
       -> lock policy row (FOR UPDATE)
       -> lock active intent (FOR UPDATE)
       -> recheck revision inside the transaction
       -> if stale: return stale_revision (no mutation)
       -> deactivate current active intent (CAS guard)
       -> insert new intent version (incremented)
       -> insert migration event (audit trail)
       -> return applied result
```

The service follows the exact transactional pattern proven by
`policyNativeIntentReversionService.mjs`: caller-owned `dbClient.withTransaction`,
row locks acquired in policy-then-intent order, CAS guards on all mutations,
and a `FAILED_ROLLED_BACK` result on any thrown error.

## Persistence Layer

`policyNativeIntentChangePersistence.mjs` provides pure DB functions taking
`{client, ...}` — never a bare client arg. All SQL is parameterized with
`$1, $2, ...` placeholders. Row locks use `FOR UPDATE`. Mutations use CAS
`WHERE` clauses guarded by `rowCount === 1`.

| Function | SQL operation |
| --- | --- |
| `lockPolicyForNativeIntentChange` | `SELECT id, library_id FROM library_policies WHERE id = $1 FOR UPDATE` |
| `lockActiveNativeIntentForChange` | `SELECT ... FROM policy_intents WHERE policy_id = $1 AND library_id = $2 AND active = TRUE FOR UPDATE` |
| `deactivateActiveNativeIntentForChange` | `UPDATE policy_intents SET active = FALSE WHERE id = $1 AND active = TRUE` (CAS, returns rowCount) |
| `insertNewNativeIntentVersion` | `INSERT INTO policy_intents (policy_id, library_id, intent_version, ...) VALUES (...) RETURNING id` |
| `insertNativeIntentChangeEvent` | `INSERT INTO policy_intent_migration_events (...) VALUES (..., 'change_applied', ...)` |

## Service

`policyNativeIntentChangeService.mjs` exports
`applyPolicyNativeIntentChange({ dbClient, policyId, expectedRevision, actorId,
actorRole, idempotencyKey, changeCommands, authorityState, legacyPayload })`.

The service:
1. Calls `buildPolicyNativeIntentChangeAdmission(...)` first — no DB hit.
2. If not admitted, returns the admission result mapped to a change result.
3. Guards `typeof dbClient?.withTransaction !== 'function'`.
4. Wraps the transaction body in try/catch, returning `FAILED_ROLLED_BACK` on error.
5. Inside the transaction: locks, rechecks, mutates, audits, returns.

## Route

`policiesRouteNativeIntentChange.mjs` registers
`POST /:id/native-intent/changes`. Auth is enforced at the mount point
(`/api/policies` requires `authenticateToken, requireAdmin`). The handler
re-checks `req.user?.role !== 'admin'`, derives `actorId` from the session,
reads `expectedRevision` and `changeCommands` from the request body, and
maps non-success results to HTTP errors.

## Official Guidance Reviewed

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at non-public endpoints and warns against relying
  on client-provided state. The route derives `policyId` from the URL, `actorId`
  from the session, and rejects browser-synthesized projections.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization. The service defaults to rejection
  unless the admission contract explicitly admits.
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents `FOR UPDATE` row-level locks. The persistence layer locks in
  policy-then-intent order to prevent deadlocks.

## Implementation Outcome

Four new modules wire the admission contract to the running application:

1. `policyNativeIntentChangeResult.mjs` — result contract with status IDs,
   risk IDs, and a builder.
2. `policyNativeIntentChangePersistence.mjs` — parameterized SQL functions
   with `FOR UPDATE` locks and CAS guards.
3. `policyNativeIntentChangeService.mjs` — transactional service that calls
   the admission contract, then locks, rechecks, mutates, and audits inside
   one transaction.
4. `policiesRouteNativeIntentChange.mjs` — administrator-only HTTP route.

The route is wired into `policiesRoutePolicyCrud.mjs` alongside the other
native-intent route registrations.

## Security Outcome

- A persisted native policy can now change through a revision-bound, audited,
  allow-listed server command with a real transaction and migration event.
- A stale or competing edit cannot overwrite a newer policy state (revision
  rechecked inside the transaction after the lock).
- Legacy update routes still cannot smuggle native fields (the change path
  uses a distinct endpoint and payload shape).
- The migration event records actor, source version, target version, reason
  code, and bounded metadata — no raw payloads or request bodies.

## Next Task

The next work is writing the remaining Playwright browser specs for the 4R.9
workflow states and investigating the GitHub security alert #107.
