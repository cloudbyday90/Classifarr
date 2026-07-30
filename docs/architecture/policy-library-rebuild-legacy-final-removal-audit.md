# Policy Library-Rebuild Legacy Final-Removal Audit

## Status

Implemented for Phase 6R.6 Task 6R.6.9.

This record defines a server-owned, non-executing final-removal plan for one
completed library rebuild. It re-evaluates compact cutover provenance and the
current removal inventory in one transaction. It does not delete source files,
mutate a running deployment, persist authorization, route media, schedule work,
or expose a browser control.

## Problem

Task 6R.6.8 establishes whether a single rebuild has completed safely. Its
artifact remains advisory: it can become stale as time passes or the source
inventory changes. A final-removal plan must therefore rebuild its inputs from
the database and current server-owned inventory rather than accept a
caller-supplied readiness result.

The removed paths are repository artifacts, not tenant data. A per-library
runtime result cannot authorize a code deletion in a deployment or a source
repository. This task consequently reports only
`ready_for_global_release_retirement_gate`; it never reports ready to delete.

```text
shared-lock transaction
  -> compact current cutover evidence
  -> current static removal inventory
  -> fresh 6R.6.8 readiness evaluation
  -> inventory fingerprint/count equality check
  -> compact non-executing per-library plan
  -> later deployment-wide release-retirement gate
```

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default and checking authorization for every requested
  action. The plan is not an authorization result: it is freshly rebuilt and
  keeps every removal and mutation permission false.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final) describes
  security-focused configuration management as controlled configuration and
  current-state monitoring. The service derives a new inventory fingerprint
  and rejects drift from the readiness inventory rather than trusting a
  previous plan.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends quality gates, health models, and documented recovery. Cutover,
  rollback disposition, native authority, inventory, per-library audit, and
  global release decision remain independent stages.
- [Microsoft Well-Architected reliability principles](https://learn.microsoft.com/en-us/azure/well-architected/reliability/principles)
  recommends tested recovery and automation that reduces human error. The
  audit preserves the closed/redacted rollback requirement and uses the same
  deterministic transaction path for every library.

## Options Considered

### 1. Accept a previously returned readiness result

Pros:

- Minimal work for the caller.

Cons:

- A prior result can be stale after inventory, authority, or rollback changes.
- A caller could pair evidence from one moment with an inventory from another.

### 2. Reuse release-wide compatibility-removal authority

Pros:

- Reuses an established artifact chain.

Cons:

- Release-wide evidence cannot prove the exact cutover provenance of one
  library rebuild.
- It conflates tenant runtime state with repository change control.

### 3. Delete legacy paths after a ready audit

Pros:

- Fewer stages.

Cons:

- A server process cannot safely mutate version-controlled source.
- A per-library state must not grant a deployment-wide deletion authority.

### 4. Fresh, non-executing per-library plan

Pros:

- Re-evaluates current evidence and inventory inside one transaction.
- Rejects stale, future, malformed, unready, or mismatched evidence.
- Separates per-library runtime proof from global release change control.
- Exposes no paths, raw evidence, or execution permission.

Cons:

- Adds a compact plan and service in addition to the readiness gate.
- Requires a separate global gate before a repository retirement change can be
  proposed.

## Final Recommendation Stack

1. Load compact policy, gate, receipt, snapshot, replacement-event, and active
   semantic-native-authority evidence under the existing shared-lock boundary.
2. Build the static deletion inventory within that boundary and recompute the
   6R.6.8 readiness contract with the same execution timestamp.
3. Accept only a valid `ready_for_final_removal_audit` readiness result no more
   than five minutes old and not materially future-dated.
4. Require exact version, status, candidate count, fingerprint, and validation
   agreement between the fresh inventory and the readiness inventory summary.
5. Project only compact policy, cutover, verification, rollback, authority, and
   inventory fields into the final-removal plan.
6. Keep `executionAuthorized`, `repositoryMutationAuthorized`,
   `runtimeDeletionAuthorized`, and every destructive side effect false.
7. Make a later global release-retirement gate aggregate current deployment
   evidence before any version-controlled code-removal change is proposed.

## Implementation Outcome

`server/src/services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs` owns the
versioned plan, freshness window, status/risk vocabulary, compact projection,
and audit. It accepts no raw candidates or evidence objects in its output and
rejects forged execution permissions.

`server/src/services/policyLibraryRebuildLegacyFinalRemovalAuditService.mjs`
is the factory-backed server entry point. Within one transaction it loads the
same compact evidence used by 6R.6.8, rebuilds the inventory, recomputes
readiness, and produces the plan. Any dependency, inventory, or database error
becomes a blocked evidence-boundary result.

No route, API handler, UI component, database migration, scheduler, provider
request, quota read, filesystem mutation, or source-code deletion was added.

## Security And Reliability Outcome

- Freshness prevents a retained readiness result from becoming long-lived
  removal authority.
- Inventory fingerprint/count equality prevents source-inventory drift from
  being silently accepted.
- The plan requires a pre-existing closed and redacted rollback snapshot and
  matching semantic native authority through the nested readiness contract.
- The audit is no more authoritative than its inputs: it explicitly marks all
  execution and mutation permissions false.
- A transaction failure produces no partial plan and no write; the return
  value is a compact fail-closed status.

## Verification

Focused server tests cover:

- a compact ready plan from matching fresh evidence;
- stale and future readiness rejection;
- changed inventory rejection;
- forged execution-authorization rejection; and
- one transaction that rebuilds evidence, inventory, readiness, and plan in
  order, with a database-boundary failure path.

## Next Task

Phase 6R.6 Task 6R.6.10 is **Library Rebuild Legacy-Path Global Release
Retirement Gate**. It should aggregate fresh 6R.6.9 plans for the deployment's
current enabled policies and bind them to one current inventory/release state.
It must remain non-executing and must not delete, hide, archive, route, or add
a browser control.
