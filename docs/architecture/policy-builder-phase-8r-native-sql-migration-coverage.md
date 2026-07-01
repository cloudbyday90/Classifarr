# Policy Builder Phase 8R Native SQL Migration Coverage

Status: implemented as the native SQL migration coverage follow-up identified by
Phase 8R.9.

## Problem

Phase 8R.9 correctly identified a gap: the native schema contract described the
target durable model, but the repository did not yet include a SQL migration or
schema snapshot coverage proving fresh-install and upgraded-install paths could
create that model.

This component closes that gap by adding the actual native intent tables,
indexes, constraints, schema snapshot, and migration tests.

## Official Guidance Reviewed

- [PostgreSQL constraints documentation](https://www.postgresql.org/docs/current/ddl-constraints.html)
  defines foreign keys and check constraints as database-level integrity
  boundaries. The migration uses foreign keys for policy, library, user,
  template, and intent relationships, plus check constraints for bounded
  sources, states, roles, collections, statuses, JSONB shape, and rollback
  windows.
- [PostgreSQL `CREATE TABLE`](https://www.postgresql.org/docs/current/sql-createtable.html)
  documents table creation and foreign key behavior. The migration creates the
  native tables with explicit referential boundaries and idempotent
  `IF NOT EXISTS` table creation.
- [PostgreSQL GIN indexes](https://www.postgresql.org/docs/current/gin.html)
  support composite values such as JSONB. The migration adds a GIN index only
  for bounded rule values that the native intent contract expects to query.
- [PostgreSQL `ALTER TABLE`](https://www.postgresql.org/docs/current/sql-altertable.html)
  documents schema-change constraints and lock behavior. This migration avoids
  rewriting existing legacy policy rows and creates additive native tables
  instead.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends verification and change-management practices for secure software.
  The migration is paired with schema snapshot tests and Phase 8R reset coverage
  so the SQL path is not treated as complete without evidence.

## Recommendations

1. **Add native storage as additive tables first.**
   The migration creates native intent tables without dropping or rewriting
   legacy preset/custom-signal storage.

2. **Enforce intent vocabulary in SQL.**
   Sources, inference states, roles, collections, operators, signal types,
   routing status, migration event types, and validation statuses are constrained
   at the database layer.

3. **Separate authority, provenance, migration, rollback, and validation.**
   Native intent headers, rules, routing targets, starter-template provenance,
   migration events, rollback snapshots, and validation status are separate
   tables.

4. **Keep rollback bounded.**
   Rollback snapshots require a positive version, JSONB object payload, restore
   path, expiration timestamp, and `expires_at > created_at`.

5. **Index runtime and migration lookups explicitly.**
   The migration adds lookup indexes for active intent versions, policy/library
   access, rule lookup, rule JSONB values, routing targets, migration events,
   rollback expiry, and validation status.

6. **Prove fresh-install snapshot coverage.**
   `database/schema/current.sql` is regenerated through the authoritative schema
   snapshot flow and migration tests assert the native tables and indexes are
   present.

## Pros And Cons

Pros:

- Converts Phase 8R native schema from contract-only to actual SQL coverage.
- Keeps migration additive and rollback-safe for existing installs.
- Gives backup/restore and post-upgrade work concrete tables to include.
- Makes schema drift visible through the existing migration and snapshot tests.
- Advances native storage without preserving legacy custom signals as a second
  model.

Cons:

- Does not yet wire live policy writes into the native tables.
- Does not yet add live backup/restore serialization for these tables.
- Requires follow-up post-upgrade apply wiring before converted policies can be
  written into native storage automatically.

## Final Recommendation Stack

- SQL migration:
  `database/migrations/20260701_160000_add_policy_intent_native_storage.sql`
- Schema snapshot:
  `database/schema/current.sql`
- Migration tests:
  `server/src/__tests__/migrations.test.mjs`
- Reset coverage contract:
  `server/src/services/policyBuilderPhase8NativeStorageTestReset.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-8r-native-sql-migration-coverage.md`

## Implemented Schema

The migration creates:

- `policy_intents`
- `policy_intent_rules`
- `policy_intent_routing_targets`
- `policy_intent_template_applications`
- `policy_intent_migration_events`
- `policy_intent_rollback_snapshots`
- `policy_intent_validation_status`

It adds indexes for:

- active native intent version per policy,
- policy lookup,
- library lookup,
- validation status,
- rule lookup,
- JSONB rule values,
- routing targets,
- template application provenance,
- migration state,
- rollback expiry,
- validation result lookup.

## Security Outcome

- Native policy authority is represented by normalized, constrained tables.
- Legacy storage remains untouched until conversion and rollback gates are ready.
- Runtime-sensitive fields are indexed explicitly instead of inferred from raw
  JSON blobs.
- Migration and rollback records are separated from current policy authority.
- Fresh-install schema snapshot and migration tests now prove the native SQL
  path exists.

## Next Step

Proceed to **Native Storage Operational Wiring**. That work should move the
Phase 8R backup/restore and post-upgrade safety contracts into live flows:
native table export/import, restore validation, post-upgrade dry-run reporting,
and atomic apply-mode conversion.
