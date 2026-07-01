# Policy Builder Phase 8R Post-Upgrade Dry-Run Wiring

## Intent

Wire native intent conversion readiness into the post-upgrade path without
applying conversion. The post-upgrade task can now produce an operator-safe
dry-run report from real policy storage, but it does not insert native rows,
write migration events, create rollback snapshots, delete legacy paths, or
change policy behavior.

This component exists to make later apply mode boring: operators and release
maintainers should be able to see what would convert, what needs review, and
which safeguards are still blocking apply before any storage mutation is
enabled.

## Official-Source Research

- PostgreSQL recommends transaction boundaries for related database changes so
  failures can roll back as one unit. This dry-run does not mutate data, but it
  produces the exact apply candidate and workflow shape that a later
  transaction-safe apply path must consume.
- PostgreSQL JSON and aggregate functions support server-side construction of
  structured policy/preset input. The loader uses bounded SQL plus JSONB
  aggregation so post-upgrade reporting does not require unbounded application
  memory scans.
- NIST SSDF emphasizes preserving evidence of secure software changes and
  verifying changes before release. This dry-run is a verification artifact, not
  a migration side effect.
- OWASP logging guidance recommends event records that are useful for
  operations without exposing sensitive data. The post-upgrade action logs only
  status, counts, and bounded error identifiers, not raw policy payloads.

Sources:

- PostgreSQL transaction tutorial:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL JSON functions and operators:
  <https://www.postgresql.org/docs/current/functions-json.html>
- PostgreSQL aggregate functions:
  <https://www.postgresql.org/docs/current/functions-aggregate.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Recommendations

### Use The Existing Phase 8R Contracts

The dry-run must compose existing Phase 8R services:

- migration candidate report,
- explicit conversion workflow,
- post-upgrade actor/source ID,
- side-effect-free validation.

Pros:

- avoids another policy interpretation path,
- keeps all readiness reasons aligned with prior Phase 8R tests,
- makes later apply mode consume the same plan shape.

Cons:

- dry-run output is only as good as the candidate report and explicit workflow
  contracts,
- behavior-sensitive conversion still needs the Phase 7R verifier before apply
  can be enabled.

### Keep The Loader Bounded

The post-upgrade loader reads `library_policies`, one library ARR mapping, and
preset attachments through a bounded query.

Pros:

- protects startup/post-upgrade from unbounded memory usage,
- produces a deterministic source count/truncation signal,
- gives operators a safe first-pass readiness report.

Cons:

- large installs may need paged follow-up reporting before apply,
- the first slice should not be treated as full migration completion when
  truncation is true.

### Report Instead Of Applying

The post-upgrade action is wired as `phase8r_native_intent_dry_run`. It returns
status, counts, selected ready policy IDs, bounded operator error IDs, and
validation state.

Pros:

- safe to run during upgrade,
- gives release/debug logs enough information to diagnose readiness,
- blocks accidental native conversion while apply gates are incomplete.

Cons:

- does not create rollback snapshots or migration events yet,
- operators still need a later apply surface or release task to convert.

## Final Recommendation Stack

Use this stack for Phase 8R.11:

1. `policyBuilderPhase8PostUpgradeDryRun.mjs` owns bounded policy loading,
   candidate reporting, explicit workflow planning, and dry-run validation.
2. `postUpgradeService.mjs` remains orchestration-only and invokes the dry-run
   service through a named action.
3. Dry-run output is operator-safe: status IDs, counts, selected IDs, bounded
   error IDs, and validation counts only.
4. Apply mode remains disabled until the next task adds a transaction-safe apply
   gate with rollback snapshot creation and operator-facing failure states.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8PostUpgradeDryRun.mjs`.
- Added a bounded SQL loader for policy, library, ARR mapping, and preset input.
- Built post-upgrade dry-run output from the Phase 8R migration candidate report
  and explicit conversion workflow.
- Used the existing `post_upgrade_apply` actor source in plan-only mode.
- Wired `phase8r_native_intent_dry_run` into `postUpgradeService`.
- Added focused tests for ready, review-required, no-policy, loader mapping, and
  orchestration paths.

Not implemented in this component:

- no native intent row inserts,
- no migration event writes,
- no rollback snapshot creation,
- no legacy path deletion,
- no scheduled release-version task registration,
- no apply mode.

## Next Step

Proceed with **Phase 8R.12 Post-Upgrade Apply Gate**. That task should consume
the dry-run output, require a current dry-run, create rollback snapshots, insert
native records and migration events in one transaction, and return clear
operator-facing failure IDs if anything blocks or rolls back.
