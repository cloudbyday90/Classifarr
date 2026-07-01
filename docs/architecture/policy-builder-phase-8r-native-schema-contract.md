# Policy Builder Phase 8R Native Schema Contract

Status: implemented as the first Phase 8R storage-boundary component.

## Problem

Phase 8R moves policy intent from compatibility projection into durable native
storage. The first component must define the storage model without creating
tables yet, so later migration work cannot drift back into legacy
`customSignals` compatibility or persist transient UI/runtime diagnostics.

## Official Guidance Reviewed

- PostgreSQL `CREATE TABLE`:
  <https://www.postgresql.org/docs/current/sql-createtable.html>
- PostgreSQL constraints:
  <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL JSON types and `jsonb` indexing:
  <https://www.postgresql.org/docs/current/datatype-json.html>
- PostgreSQL GIN indexes:
  <https://www.postgresql.org/docs/current/gin.html>
- PostgreSQL partial indexes:
  <https://www.postgresql.org/docs/current/indexes-partial.html>
- PostgreSQL `ALTER TABLE` validation pattern:
  <https://www.postgresql.org/docs/current/sql-altertable.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>

## Recommendations

1. Define native intent storage as explicit relational tables with bounded JSONB
   only where the product contract needs structured values or validation output.
2. Keep durable policy intent separate from routing targets, template
   provenance, migration events, rollback snapshots, and validation status.
3. Use a partial unique active-version index so only one active native intent
   version exists per policy.
4. Use GIN only for bounded native rule values, not raw provider/replay payloads.
5. Require server validation before native writes become active.
6. Do not persist UI draft state, transient readiness, provider payloads,
   prompts, traces, embeddings, replay diagnostics, or impact-preview payloads.

## Pros And Cons

Pros:

- Gives migration code a concrete target before any table is created.
- Ends the `customSignals`-as-product-model pattern for converted policies.
- Keeps rollback and migration metadata auditable without making rollback
  snapshots a second permanent policy model.
- Preserves Phase 5R validation, Phase 6R intent/readiness output, and Phase 7R
  runtime/verifier contracts.

Cons:

- Does not yet migrate or read any runtime policy from native storage.
- Requires the next Phase 8R components to convert this contract into SQL,
  dry-run reporting, conversion workflow, read paths, and deletion gates.

## Final Recommendation Stack

- Contract service: `policyBuilderPhase8NativeSchemaContract.mjs`
- Native tables:
  - `policy_intents`
  - `policy_intent_rules`
  - `policy_intent_routing_targets`
  - `policy_intent_template_applications`
  - `policy_intent_migration_events`
  - `policy_intent_rollback_snapshots`
  - `policy_intent_validation_status`
- Required indexes:
  - policy lookup,
  - library lookup,
  - unique active intent version,
  - rule lookup,
  - rule values GIN,
  - routing target lookup,
  - migration state,
  - rollback expiry,
  - validation status.
- Next component: Phase 8R.2 Migration Candidate Report.

## Implemented Files

- `server/src/services/policyBuilderPhase8NativeSchemaContract.mjs`
- `server/src/__tests__/services/policyBuilderPhase8NativeSchemaContract.test.mjs`

## Outcome

Phase 8R.1 now has a side-effect-free native schema contract and validator.
Validation fails when required tables, storage sections, indexes, foreign keys,
Phase 5R rule fields, active-version uniqueness, rollback expiry, or server
validation gates are missing. It also rejects forbidden durable fields such as
UI draft state, provider payloads, prompts, traces, embeddings, replay
diagnostics, and impact-preview payloads.
