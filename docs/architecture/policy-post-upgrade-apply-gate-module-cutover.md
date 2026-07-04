# Policy Post-Upgrade Apply Gate Module Cutover

## Intent

Cut the post-upgrade apply gate over from phase-coded production names to durable
policy-domain names without changing native conversion behavior. The apply gate
still requires a current dry-run, a database transaction boundary, rollback
snapshot creation, idempotency checks, migration events, and bounded
operator-facing failure states.

## Official-Source Research

- PostgreSQL transaction guidance supports grouping related writes so failures
  roll back as one unit. The apply gate keeps native header, child rows,
  rollback snapshot, validation status, and migration events in one transaction.
- PostgreSQL `INSERT ... RETURNING` and DML returning guidance support retrieving
  generated intent IDs inside the same write path without a race-prone follow-up
  lookup.
- PostgreSQL JSONB support remains appropriate for structured rollback snapshot
  payloads and migration metadata.
- NIST SSDF recommends traceable verification evidence for secure software
  changes.
- OWASP logging guidance recommends useful operational status without exposing
  full sensitive payloads.

Sources:

- PostgreSQL transactions:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL `INSERT`:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL returning data from modified rows:
  <https://www.postgresql.org/docs/current/dml-returning.html>
- PostgreSQL JSON types:
  <https://www.postgresql.org/docs/current/datatype-json.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Recommendations

### Keep The Apply Gate Product-Named

The payload version, service exports, post-upgrade action, migration reason
code, tests, and docs should use `policy.post_upgrade_apply_gate.v1`,
`policyPostUpgradeApplyGate*`, and `policy_post_upgrade_apply_gate`.

Pros:

- removes roadmap numbering from a production mutation path,
- makes the apply gate reusable outside the current roadmap,
- keeps dry-run and apply naming aligned.

Cons:

- release notes must preserve historical phase-coded action names for older
  entries while current docs move to the durable action.

### Preserve Transaction And Rollback Semantics

The cutover must not weaken the requirement that native apply writes happen only
inside `db.withTransaction`.

Pros:

- avoids partial native/legacy mixed states,
- keeps rollback assumptions explicit,
- preserves operator-safe failure reporting.

Cons:

- very large installs may still need a later batching model.

### Replace Local Phase Handoffs

The apply gate should expose
`nextStep.stepId = native_runtime_cutover_verification` instead of
`nextPhase.phaseId`.

Pros:

- removes phase numbering from runtime payloads,
- keeps the next operator action clear,
- aligns with the production-name inventory direction.

Cons:

- downstream tests need semantic handoff assertions.

## Final Recommendation Stack

1. Rename the apply-gate service, focused test, and architecture record to
   `policyPostUpgradeApplyGate.mjs`,
   `policyPostUpgradeApplyGate.test.mjs`, and
   `policy-post-upgrade-apply-gate.md`.
2. Move the apply-gate version to `policy.post_upgrade_apply_gate.v1`.
3. Export durable helpers:
   - `buildPolicyPostUpgradeApplyGate`
   - `applyPolicyPostUpgradeApplyGate`
   - `runPolicyPostUpgradeApplyGate`
   - `validatePolicyPostUpgradeApplyGate`
4. Wire the post-upgrade action as `policy_post_upgrade_apply_gate`.
5. Use `policy_post_upgrade_apply` as the native migration reason code.
6. Keep rollback restore paths under `policy/post-upgrade/rollback/...`.
7. Keep legacy preset/custom-signal deletion out of the apply gate.

## Implementation Outcome

Implemented:

- Renamed the apply-gate service, focused test, and architecture document.
- Replaced phase-coded apply-gate constants, payload version, and exported
  builder/apply/runner names with durable policy-domain names.
- Replaced the post-upgrade apply action with
  `policy_post_upgrade_apply_gate`.
- Replaced migration event reason codes with `policy_post_upgrade_apply`.
- Replaced fallback rollback restore paths with
  `policy/post-upgrade/rollback/...`.
- Replaced the runtime handoff with
  `nextStep.stepId = native_runtime_cutover_verification`.
- Preserved current dry-run requirement, transaction-bound apply, idempotency
  guard, rollback snapshot creation, migration events, no legacy deletion, and
  bounded operator error reporting.

Not implemented in this component:

- no automatic release-version post-upgrade apply task,
- no runtime read-path cutover,
- no compatibility-path deletion,
- no apply batching model.

## Next Step

Cut over the **Native Runtime Cutover Verification** module naming while
preserving converted/unconverted read-source verification and rollback-support
diagnostics.
