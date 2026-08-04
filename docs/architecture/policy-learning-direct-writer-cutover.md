# Policy Learning Direct Writer Cutover

## Status

Complete for Phase 5R.6.4. This record inventories every current direct
learning/evidence mutation path and establishes the cutover rule: normal
classification runtime can write durable learning only through the authorized
outcome transaction executor.

## Problem

The re-imagined policy model separates resolving an item from learning from it.
Several older paths still converted a routine classification, retry, library
sync, or manual reclassification into broad or exact durable evidence. Those
writes could bypass the current learning guard, command audit, source-event
receipt, and bounded provenance chain.

That behavior creates two risks:

- A successful or manually routed item can silently become future policy
  authority.
- A retry, synchronization pass, or compatibility workflow can change durable
  evidence without a replay-safe, attributable decision.

## Research Basis

The selected design follows these current primary-source recommendations:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): apply least privilege, deny by default,
  validate authorization at the server boundary, log security decisions, and
  test authorization logic. Learning writes are authorization-sensitive state
  changes, so a service import is not sufficient authority.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): security-relevant events need reliable context
  for who, what, when, and where, while avoiding sensitive raw payloads.
  The authorized executor's command, outcome, provenance, and receipt form the
  durable audit context; logs remain bounded diagnostics.
- [GitHub dependency graph documentation](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-graph-data): lockfiles describe the
  resolved direct and transitive dependency graph. This change retains lockfile
  based dependency verification for the affected server and client workspaces.
- [npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/):
  dependency auditing evaluates the installed dependency tree represented by
  the lockfile. Both workspaces are audited as part of verification.

## Writer Inventory

The machine-readable inventory is
`server/src/services/policyLearningWriterInventory.mjs`. It intentionally
tracks the write authority, not every read of legacy evidence.

| Writer or path | Classification | Outcome |
| --- | --- | --- |
| Authorized outcome executor exact-item memory | Authorized executor integration | Remains the sole exact-item runtime writer. It requires the guard, command audit, source-event receipt, and provenance record. |
| Authorized outcome executor compatibility/identity evidence | Authorized executor integration | Remains the sole automatic destination-evidence writer with the same controls and profile-refresh outbox. |
| Evidence administration promote, decay, and filtered purge | Controlled maintenance only | Retained behind authenticated admin routes; it is not classification runtime learning. |
| Backup restore and table restore | Controlled maintenance only | Retained for explicit restore/replace operations. |
| Clear-and-resync cleanup | Controlled maintenance only | Retained as a destructive administrative reset, not an automation path. |
| Classification-evidence backfill | Migration only | Retained for CLI migration work only. |
| `ClassificationService` automatic reinforcement | Removed from normal runtime | Classification completion no longer schedules broad pattern or genre learning. |
| Queue administration manual classification exact memory | Removed from normal runtime | Queue completion records routing and history only. A durable memory decision must use the authorized outcome command. |
| Classification retry purge-learning option | Removed from normal runtime | The HTTP route rejects the option; retry cannot delete learning evidence. |
| Reclassification learned-correction upsert | Removed from normal runtime | Reclassification no longer writes `learned_corrections` as a side effect. |
| Media-sync reconciliation learned-correction upsert | Removed from normal runtime | Observed library state remains evidence, but synchronization no longer creates learned corrections. |
| Classification evidence reinforcement service | Deletion candidate | It has no production caller after this cutover and must not regain one. |
| Legacy pattern reinforcement service | Deletion candidate | Its automatic reinforcement methods have no authorized runtime caller. |

`classificationLearnedCorrectionsService` is a legacy reader, not a writer in
this cutover. Its remaining decision influence is explicitly covered by the
next regression component rather than being misrepresented as solved by writer
removal alone.

## Options Considered

### Keep Compatibility Writers

Pros:

- Lowest immediate source churn.
- Existing operational flows retain their historical side effects.

Cons:

- Any routine path can bypass authorization and receipt controls.
- An item resolution can become broad policy authority without an explicit
  decision.
- No credible way to prove which paths still mutate learning data.

### Add Optional Guard Flags To Existing Writers

Pros:

- Fewer call-site changes than a full cutover.
- Existing maintenance functions could share a common parameter shape.

Cons:

- A forgotten default, test-only override, or new caller can restore the
  bypass.
- The actual authorization boundary remains distributed across legacy paths.
- Flags do not create the required receipt, outcome, or provenance record.

### Selected: One Authorized Runtime Executor, Explicit Maintenance Scopes

Pros:

- Normal runtime learning has one auditable authority path.
- Retries, sync, routing, and reclassification remain outcome-focused and
  platform-agnostic.
- Backup, migration, and administrative reset behavior remain available but
  cannot be mistaken for automatic learning.
- The immutable inventory and focused tests make future drift visible.

Cons:

- An operator must use the purpose-specific learning command when durable
  exact-item memory is desired.
- Deletion candidates need a later migration/retirement step rather than being
  removed blindly.

## Final Recommendation Stack

1. Keep `policyAuthorizedOutcomeTransactionExecutor` as the only automatic
   runtime learning writer and require all four controls for every executor
   integration.
2. Keep backup, migration, admin evidence maintenance, and destructive reset
   code explicitly maintenance-scoped and excluded from normal classification
   flows.
3. Reject retry-time learning deletion rather than accepting an option that no
   longer has authorized semantics.
4. Keep unresolved legacy readers and deletion candidates visible in the
   inventory until their migration and regression coverage is complete.
5. Use Phase 5R.6.5 to protect the source-level boundary against future direct
   calls, stale question state, raw AI context retention, duplicate events, and
   cross-destination writes.

## Implementation Outcome

- Removed automatic classification reinforcement from
  `classificationServiceCore.mjs`.
- Removed exact-item memory from `queueAdminService.mjs`.
- Removed retry-time evidence purge support from the HTTP route and retry
  service; requests attempting it now fail closed with a validation error.
- Removed implicit `learned_corrections` writes from reclassification and
  media-sync reconciliation.
- Added `policyLearningWriterInventory.mjs` and its focused test to keep the
  permitted runtime writers and retired paths explicit.

## Verification

- Focused server tests cover retry rejection/no purge, queue administration,
  media synchronization, the writer inventory, and existing authorized
  executor behavior.
- Full workspace tests, lint/type checks, and `npm audit` run before merge.
- Dependency-alert remediation is checked against both lockfiles and the
  repository dependency graph; Dependabot alert closure can lag a pushed
  lockfile update.

## Follow-up

Next task: **Phase 5R.6.5, Learning Boundary Regression Suite**. It will add
path-level source and behavior tests so a direct writer cannot be reintroduced
outside the authorized executor.
