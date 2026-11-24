# Source-pair budget classification outcome

November 24, 2026. See the
[design and recommendations](source-pair-budget-classification-design.md).

The source-pair evaluator now recognizes `evidence_budget` only on errors
marked by an exceeded parent-side evidence limit. Snapshot, policy, vector
and worker input guards keep their existing messages for other callers.
Missing configuration, malformed input, and unrelated failure text use
`evaluation_unavailable`. The discovery wrapper accepts the three reasons
the admission service emits.

The evaluator still persists the same reason vocabulary and logs the existing
failure stages. The real PostgreSQL constraint failure now records
`evaluation_unavailable` at `publication`. The failed transaction rolls
back the report, history and cursors, and the existing cooldown applies.
An actual snapshot library-count overflow continues to record
`evidence_budget`. The child-worker protocol stays unchanged.

## Verification

- 119 focused tests passed. They exercise both worker input size guards
  and confirm that equal-message errors, missing configuration, invalid
  input and unsupported discovery reasons cannot become budget failures.
- All 59 isolated PostgreSQL tests passed, including the actual publication
  constraint rollback and the same-ID queue recovery contract.
- The ownership review refreshed four source fingerprints. Their existing
  analysis and classifications remain identical. All three npm audits
  reported zero advisories.
- Full backend verification passed 64,706 tests across 1,958 suites with
  one test skipped. Coverage reached 89.33% of lines and statements, and
  86.93% of branches. The coverage ratchet passed with unchanged client
  inputs and verified client coverage report hashes.
- Lint, type checking, CI preflight, policy and import gates, Markdown lint
  and staged secret scanning passed.

## Next recommended item

Audit child evaluation failures before adding any worker failure codes to the
transport. Start with the feature-count ceiling in
[learned profile fitting](../../server/src/services/inventoryLearnedProfiles.mjs).
Reproduce an input that crosses that ceiling after passing the parent checks.
Use that evidence to decide whether to forward a bounded reason through the
existing validated message envelope.
