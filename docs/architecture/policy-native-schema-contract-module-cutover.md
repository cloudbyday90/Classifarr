# Policy Native Schema Contract Module Cutover

## Status

Implemented on July 4, 2026 as the durable module-name cutover for the native
policy intent schema contract.

This cutover changes names, imports, and contract identifiers only. It does not
create tables, run migrations, convert policies, enable native runtime reads,
or delete legacy compatibility paths.

## Official Guidance Reviewed

- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  define primary keys, foreign keys, unique constraints, not-null constraints,
  and check constraints as the database-level boundary for valid data. The
  schema contract keeps referential and active-version expectations explicit.
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
  support indexes over a subset of rows. The native schema contract keeps the
  active-intent uniqueness boundary as a partial unique index.
- [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html)
  distinguish JSON storage options and JSONB behavior. Classifarr uses JSONB
  only for bounded rule values and validation output, not provider payloads,
  prompts, embeddings, or replay diagnostics.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure software development practices that reduce vulnerabilities
  and address root causes. This contract preserves server validation and
  side-effect-free checks before SQL migration or conversion can proceed.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides verification requirements for secure application behavior. The
  schema validator treats forbidden durable fields and missing write gates as
  verification failures.

## Recommendation

Keep native schema definition as a durable product-domain contract:

```text
policy intent schema contract
  -> SQL migration coverage
  -> migration candidate report
  -> explicit conversion workflow
```

The contract should be imported as `policyNativeSchemaContract.mjs` and expose
durable `POLICY_NATIVE_SCHEMA_*` symbols and `policy.native_schema_contract.v1`.

## Pros And Cons

Pros:

- Removes a phase-coded production service and focused test name.
- Moves the schema contract version to `policy.native_schema_contract.v1`.
- Replaces schema-local phase risk ids and audit handoff with product-domain
  terms.
- Keeps downstream native storage services importing one durable schema
  contract.
- Preserves side-effect-free validation before migration or conversion.

Cons:

- Downstream native storage services still have their own phase-coded names and
  will need separate cutovers.
- This does not alter the database migration filename or table DDL.
- Documentation history still contains older Phase 8R records until their
  components are cut over.

## Final Implementation Stack

1. Rename the service to `server/src/services/policyNativeSchemaContract.mjs`.
2. Rename the focused test to
   `server/src/__tests__/services/policyNativeSchemaContract.test.mjs`.
3. Rename the active architecture record to
   `docs/architecture/policy-native-schema-contract.md`.
4. Move exported constants to `POLICY_NATIVE_SCHEMA_*`.
5. Move exported functions to:
   - `listPolicyNativeSchemaTables`,
   - `buildPolicyNativeSchemaContract`,
   - `validatePolicyNativeSchemaContract`,
   - `buildPolicyNativeSchemaContractAudit`.
6. Move the payload version to `policy.native_schema_contract.v1`.
7. Replace schema-local phase risk ids with durable risk ids:
   - `rules_not_mapped_to_server_contract`,
   - `intent_engine_output_not_representable`.
8. Replace schema-local handoff fields with
   `nextStep.stepId = migration_candidate_report`.
9. Update direct native storage consumers, docs, changelog, and inventory
   evidence.

## Security Boundary

- No database tables are created.
- No migrations are run.
- No policies are converted.
- No legacy writes are disabled.
- No native runtime read path is enabled.
- The contract continues to reject UI draft state, transient readiness,
  provider payloads, prompts, traces, embeddings, replay diagnostics, and
  impact-preview payloads as durable fields.
- Server validation remains required before native writes can become active.

## Outcome

The native schema contract now uses durable product naming while preserving the
same table definitions, required indexes, referential boundaries, rollback
expiry validation, forbidden durable field checks, and side-effect-free posture.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyNativeSchemaContract|policyNativeSqlMigrationCoverage|policyNativeStorageOperationalSafety|policyBuilderPhase8ExplicitConversionWorkflow|policyBuilderPhase8NativeStorageTestReset|policyBuilderProductionNameInventory" --no-coverage --runInBand
npm run lint:docs
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
```

## Completed Handoff

Native SQL Migration Coverage received the next module cutover and now uses
durable product-domain naming:
[Policy Native SQL Migration Coverage Module Cutover](policy-native-sql-migration-coverage-module-cutover.md).
