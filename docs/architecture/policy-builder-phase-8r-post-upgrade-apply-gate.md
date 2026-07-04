# Policy Builder Phase 8R Post-Upgrade Apply Gate

## Intent

Add the first real native intent conversion apply gate for post-upgrade work
without scheduling it automatically. The gate consumes a current post-upgrade
dry-run, blocks stale or invalid reports, requires a database transaction
boundary, creates rollback snapshots, writes native intent records, and records
migration events atomically.

This component is not legacy cleanup. It converts ready policies to native
intent storage while keeping legacy preset/custom-signal paths undeleted until
later runtime cutover and deletion gates prove safe.

## Official-Source Research

- PostgreSQL documents that related writes should be wrapped in `BEGIN` and
  `COMMIT`, with `ROLLBACK` discarding updates when the transaction fails. The
  apply gate therefore requires `db.withTransaction` before it can write native
  records.
- PostgreSQL `INSERT ... RETURNING` is the correct way to retrieve generated
  native intent IDs for child rows in the same workflow without a follow-up
  lookup race.
- PostgreSQL JSONB support allows structured rollback snapshot payloads and
  metadata to remain queryable without creating a permanent second legacy policy
  model.
- OWASP logging guidance recommends logging enough event attributes for
  monitoring and analysis without dumping full sensitive payloads. The
  post-upgrade service logs bounded status, counts, and error identifiers only.
- NIST SSDF emphasizes verified changes and traceable release evidence. The
  gate requires a current dry-run and emits migration events so conversion
  evidence is reconstructable.

Sources:

- PostgreSQL transactions:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL `INSERT`:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL returning data from modified rows:
  <https://www.postgresql.org/docs/current/dml-returning.html>
- PostgreSQL JSON types:
  <https://www.postgresql.org/docs/current/datatype-json.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>

## Recommendations

### Require A Current Dry-Run

Apply should not recompute and immediately trust a new opaque decision without
surfacing the dry-run state. The gate consumes a dry-run with a bounded currency
window and blocks missing, invalid, stale, or no-ready-step reports.

Pros:

- prevents old readiness data from applying after policies changed,
- gives operators a clear readiness contract,
- keeps dry-run and apply semantics aligned.

Cons:

- operators may need to rerun dry-run if the window expires,
- very large installs still need paged readiness reporting before broad apply.

### Require Transaction-Bound Writes

Native header, rollback snapshot, rules, routing target, template provenance,
validation status, and migration events must be written in one transaction.

Pros:

- failure leaves legacy behavior active,
- avoids partial native/legacy mixed states,
- makes rollback assumptions explicit.

Cons:

- transaction duration grows with the number of ready policies,
- later batching may be needed for very large installs.

### Keep Legacy Deletion Out Of Apply

The apply gate writes native storage only. It does not delete preset
attachments, custom-signal compatibility data, old UI artifacts, or bridge
logic.

Pros:

- conversion can be tested before compatibility paths disappear,
- rollback and support remain possible during the bounded window,
- deletion remains controlled by later Phase 8R gates.

Cons:

- converted installs temporarily have both native and compatibility records,
- later cutover/deletion work is still required.

## Final Recommendation Stack

Use this stack for Phase 8R.12:

1. Require `policy.post_upgrade_dry_run.v1` output that is valid, ready, and
   not expired.
2. Require `db.withTransaction` before any native apply writes.
3. For each ready policy:
   - skip if active native intent for the target version already exists,
   - validate the server intent contract again,
   - insert native intent header with `RETURNING id`,
   - create rollback snapshot,
   - insert native rules, routing target, template applications, validation
     status, and migration events,
   - keep legacy paths undeleted.
4. On any failure, return `failed_rolled_back` with bounded operator error IDs.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8PostUpgradeApplyGate.mjs`.
- Added a pure apply-gate evaluator for missing, invalid, stale, no-ready-step,
  missing transaction-boundary, and ready states.
- Added transaction-only apply that writes native intent header, rollback
  snapshot, rules, routing target, template applications, validation status, and
  migration events.
- Added idempotency guard for already-active target-version native intents.
- Wired `phase8r_native_intent_apply_gate` into `postUpgradeService` without
  registering it as an automatic version task.
- Added focused tests for missing dry-run, stale dry-run, successful
  transaction apply, and rollback-safe failure reporting.

Not implemented in this component:

- no automatic release-version post-upgrade apply task,
- no legacy preset/custom-signal deletion,
- no runtime cutover verification,
- no rollback-window cleanup,
- no support UI for invoking apply.

## Next Step

Proceed with **Phase 8R.13 Native Runtime Cutover Verification**. That task
should prove converted policies read from native intent in real route/service
paths, expose safe support diagnostics, and keep rollback available before any
legacy compatibility code is deleted.
