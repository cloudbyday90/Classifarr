# Policy Post-Upgrade Dry-Run Wiring Module Cutover

## Intent

Cut the post-upgrade dry-run component over from phase-coded production names to
durable policy-domain names without changing conversion behavior. The dry-run is
still side-effect-free, bounded, operator-safe, and consumed by the later
post-upgrade apply gate.

## Official-Source Research

- PostgreSQL recommends transactions for related writes. This component remains
  read-only, but keeps producing the exact plan shape that a later transactional
  apply gate consumes.
- PostgreSQL JSON and aggregate functions support bounded, structured loader
  output without ad hoc string parsing.
- NIST SSDF recommends traceable verification evidence for secure software
  changes.
- OWASP logging guidance recommends useful operational events without dumping
  sensitive payloads.

Sources:

- PostgreSQL transactions:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL JSON functions and operators:
  <https://www.postgresql.org/docs/current/functions-json.html>
- PostgreSQL aggregate functions:
  <https://www.postgresql.org/docs/current/functions-aggregate.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Recommendations

### Keep The Dry-Run Contract Product-Named

The payload version, service exports, tests, and post-upgrade runner should use
`policy.post_upgrade_dry_run.v1` and `policyPostUpgradeDryRun*` names.

Pros:

- removes phase-local naming from active production contracts,
- makes the dry-run reusable outside a single migration roadmap,
- keeps test names aligned with the product capability.

Cons:

- adjacent apply-gate code must temporarily import the renamed dry-run helpers
  until the apply gate receives its own cutover.

### Replace Local Phase Handoffs

The dry-run should expose `nextStep.stepId = post_upgrade_apply_gate` instead of
`nextPhase.phaseId`.

Pros:

- avoids encoding roadmap numbering in runtime payloads,
- gives operators a plain-language next action,
- matches the broader production-name inventory direction.

Cons:

- downstream tests that asserted phase IDs must update to semantic step IDs.

### Preserve Operator-Safe Output

The cutover must not change data loaded, selected policy IDs, validation
behavior, no-side-effect checks, or logging boundaries.

Pros:

- makes the refactor low risk,
- keeps post-upgrade behavior auditable,
- prevents accidental native writes during naming cleanup.

Cons:

- the larger apply-gate and runtime-cutover phase-coded modules still need their
  own component-level cutovers.

## Final Recommendation Stack

1. Rename the dry-run service, focused test, and architecture record to
   `policyPostUpgradeDryRun.mjs`, `policyPostUpgradeDryRun.test.mjs`, and
   `policy-post-upgrade-dry-run-wiring.md`.
2. Move the dry-run version to `policy.post_upgrade_dry_run.v1`.
3. Export durable helpers:
   - `buildPolicyPostUpgradeDryRun`
   - `loadPolicyPostUpgradePolicies`
   - `runPolicyPostUpgradeDryRun`
   - `validatePolicyPostUpgradeDryRun`
4. Keep post-upgrade orchestration thin with the existing
   `policy_native_intent_dry_run` action and a renamed
   `runPolicyPostUpgradeDryRun` method.
5. Keep the apply-gate module behavior unchanged except for imports that consume
   the renamed dry-run helpers.

## Implementation Outcome

Implemented:

- Renamed the dry-run service, focused test, and architecture document.
- Replaced phase-coded dry-run constants and builder exports with durable
  policy-domain names.
- Replaced the dry-run payload handoff with
  `nextStep.stepId = post_upgrade_apply_gate`.
- Updated post-upgrade orchestration to call `runPolicyPostUpgradeDryRun`.
- Updated the adjacent apply-gate imports to consume the renamed dry-run helper.
- Preserved bounded SQL loading, plan-only explicit conversion workflow
  composition, no-side-effect validation, bounded operator error IDs, and safe
  logging.

Not implemented in this component:

- no apply-gate service rename,
- no automatic release-version conversion task,
- no native conversion apply behavior changes,
- no legacy compatibility deletion.

## Next Step

Cut over the **Post-Upgrade Apply Gate** module names while preserving its
existing transaction-bound apply, rollback snapshot, idempotency, and
operator-error behavior.
