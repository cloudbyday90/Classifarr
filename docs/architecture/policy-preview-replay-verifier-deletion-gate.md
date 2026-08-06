# Policy Preview/Replay Verifier Deletion Or Promotion Gate

## Status

Implemented as Phase 5R.8 Task 5R.8.4 on August 6, 2026.

## Decision

The retained preview/replay verifier artifacts may not be deleted or promoted
until a side-effect-free, fail-closed gate proves that **all four** exit
criteria are simultaneously satisfied:

```text
native migration parity proven
  + native storage cutover complete
  + rollback retention window expired
  + no active rebuild binding
  -> ready for verifier deletion or promotion
```

The gate is a pure evaluation service. It consumes evidence inputs, never
performs its own database queries, file mutations, route removals, test
deletions, or storage writes. It default-denies every artifact unless every
condition is explicitly proven by the caller's evidence. A missing or `null`
evidence field is treated as unproven, not as implicitly satisfied.

The gate does not distinguish between "delete" and "promote" outcomes: both
require the same four conditions. If migration parity is proven but a rollback
window has not expired, the artifacts must remain regardless of whether the
plan is deletion or promotion. The only difference is that a promotion also
requires an accepted runtime-evidence replacement contract, which the gate
evaluates as an additional per-artifact condition.

## Gate Conditions

Each condition is evaluated independently and contributes a bounded blocker
when unproven:

| Condition | Evidence input | Blocks when |
| --- | --- | --- |
| Migration parity proven | `migrationParityEvidence` | Missing, `proven !== true`, or validation failed |
| Native storage cutover complete | `nativeStorageCutoverEvidence` | Missing, `complete !== true`, or unconverted policies remain |
| Rollback retention window expired | `rollbackRetentionEvidence` | Missing, `expired !== true`, or snapshots remain unredacted |
| No active rebuild binding | `rebuildBindingEvidence` | Missing, `noActiveBinding !== true`, or active bindings remain |

For promotion (not deletion), each artifact that carries a
`runtime_evidence_replacement_accepted` exit criterion must also provide
`promotionReplacementEvidence` proving an accepted replacement contract
exists. Since 5R.8.3 resolved the evidence reducer as migration-only (not
promoted), no current artifact requires promotion evidence. The gate enforces
the condition structurally so a future artifact cannot be promoted without it.

## Official Guidance Reviewed

- [OWASP API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  requires an explicit retirement plan for every retained API version or
  endpoint. This gate is the final retirement-plan enforcement point for the
  retained verifier artifacts: it prevents silent retention without proven
  exit criteria.
- [OWASP A06:2021 Vulnerable and Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)
  recommends maintaining a continuous inventory, removing unused functionality,
  and addressing unmaintained components. The gate consumes the 5R.8.1 cutline
  inventory so every retained artifact has a bounded deletion decision before
  it can become a maintenance liability.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization. The gate defaults every artifact
  to blocked unless all conditions are explicitly proven.
- [NIST Secure Software Development Framework (SSDF)](https://csrc.nist.gov/projects/ssdf)
  supports traceable, maintainable software changes. The gate records which
  evidence was evaluated, which conditions blocked, and which artifacts are
  ready, so the deletion decision is auditable.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends treating cross-trust-zone data as untrusted and retaining only
  necessary, protected event data. The gate output contains only bounded
  status summaries, risk IDs, and evidence fingerprints — no raw policy
  payloads, snapshots, or verifier differences.

## Options Considered

### 1. Delete all verifier artifacts immediately

Pros:

- Smallest attack surface and least maintenance.
- Removes all migration verifier terminology from live code immediately.

Cons:

- Removes the parity gate that currently protects rollback evidence and
  cutover while Phase 8R installation cutover is still in progress per
  deployment.
- Weakens the evidence chain needed before all installations have converted.
- Is premature: the task is explicitly gated on Phase 8R cutover evidence,
  which is per-installation, not per-release.

### 2. Let the existing Phase 8R compatibility deletion readiness gate handle it

Pros:

- No new gate service.
- Reuses the 8R.14 `policyCompatibilityDeletionReadiness` pattern.

Cons:

- The 8R.14 gate evaluates compatibility path deletion (legacy
  preset/custom-signal code), not the retained migration verifier chain.
  The verifier artifacts have different exit criteria (migration parity proof,
  rollback retention expiry) than compatibility code (unconverted policy count,
  reconciliation state).
- The 8R.14 gate does not consume the 5R.8.1 cutline inventory, so it cannot
  evaluate per-artifact promotion vs deletion decisions.
- Conflating the two gates would blur the boundary between compatibility path
  retirement and migration verifier retirement.

### 3. Build a dedicated, side-effect-free verifier deletion gate

Pros:

- Evaluates exactly the four conditions the roadmap requires, per artifact.
- Consumes the 5R.8.1 cutline inventory so every retained artifact has a
  bounded decision.
- Default-denies unless all conditions are explicitly proven by caller
  evidence.
- Is simple to test without database, route, or file access.
- Follows the proven pattern of `policyCompatibilityDeletionReadiness.mjs`.
- Handles promotion evidence structurally without allowing it by default.

Cons:

- Adds one more gate service to the migration domain.
- Requires the caller to supply current evidence inputs (the gate does not
  query the database itself).

### 4. Defer the gate until Phase 8R installation cutover is complete

Pros:

- No work until the conditions could potentially be satisfied.

Cons:

- Leaves no regression-tested contract that proves what conditions are
  required. A future change could delete verifier artifacts without checking
  all four conditions.
- Does not satisfy the roadmap's explicit task definition.
- Delays the closure of Phase 5R.8, which blocks 5R.9 and 5R.10.

## Final Recommendation Stack

1. Build a dedicated, pure, side-effect-free gate service that evaluates all
   four exit criteria against caller-supplied evidence.
2. Default-deny every artifact unless all conditions are explicitly proven;
   treat missing or null evidence as unproven.
3. Consume the 5R.8.1 cutline inventory so every active artifact receives a
   bounded per-artifact decision.
4. For promotion requests, require an additional accepted runtime-evidence
   replacement contract per artifact; since 5R.8.3 resolved the reducer as
   migration-only, no current artifact qualifies for promotion.
5. Emit only bounded status summaries, blocker risk IDs, evidence
  fingerprints, and artifact paths — no raw payloads, snapshots, differences,
  or verifier internals.
6. Self-validate like the existing gate services: re-derive status from risks,
  verify the ready flag, enforce immutable deletion policy, and reject side
  effects.
7. Require a separate execution step (not this gate) to perform the actual
  deletion or promotion. The gate is read-only evaluation, never execution.

## Implementation Outcome

`server/src/services/policyPreviewReplayVerifierDeletionGate.mjs` owns the
gate contract. It defines the four exit criteria, the per-artifact evaluation
logic, the status derivation, the self-validation, and the bounded output
shape. It performs no read, write, routing, learning, provider, scheduler, or
file operation.

The gate consumes the 5R.8.1 cutline inventory
(`listPolicyPreviewReplayVerifierArtifacts`) and evaluates each active
artifact against the four evidence inputs. Retired artifacts are verified as
absent but do not require deletion-gate evaluation. The gate returns one
of these statuses:

- `ready_for_verifier_deletion`
- `blocked_by_migration_parity`
- `blocked_by_native_storage_cutover`
- `blocked_by_rollback_retention`
- `blocked_by_active_rebuild_binding`
- `blocked_by_promotion_replacement`
- `blocked_by_cutline_inventory`

Focused regression tests cover the clean current-state audit, each individual
blocker condition, all-blocked, promotion without replacement evidence,
cutline inventory drift, an unsafe deletion execution flag, a broken
immutable policy, and side-effect rejection.

## Security Outcome

- No retained verifier artifact can be deleted or promoted without all four
  exit criteria being explicitly proven.
- The gate cannot execute deletions, file mutations, route removals, or test
  changes; it only evaluates and reports.
- The gate output contains no raw policy payloads, verifier differences,
  rollback snapshots, or provider data.
- The self-validation rejects a ready claim that disagrees with its risks, a
  mutated deletion policy, or any performed side effect.
- The cutline inventory is consumed so the gate cannot silently miss an
  artifact that was added without a deletion decision.

## Next Task

Phase 5R.8 is now complete. The next task is **5R.9 Server Authority Test
Reset**, which categorizes Phase 5 tests as keep, rewrite, or delete to
protect the server trust boundaries established by 5R.1 through 5R.8.
