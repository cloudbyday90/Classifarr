import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PHASE8R_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyBuilderPhase8NativeSchemaContract,
  listPolicyBuilderPhase8NativeSchemaTables,
} from '../../services/policyBuilderPhase8NativeSchemaContract.mjs';
import {
  PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS,
  buildPolicyBuilderPhase8NativeSqlMigrationCoverage,
  validatePolicyBuilderPhase8NativeSqlMigrationCoverage,
} from '../../services/policyBuilderPhase8NativeSqlMigrationCoverage.mjs';

const migrationPath = path.resolve(
  import.meta.dirname,
  '../../../../database/migrations/20260701_160000_add_policy_intent_native_storage.sql'
);

function readMigrationSql() {
  return readFileSync(migrationPath, 'utf8');
}

describe('policyBuilderPhase8NativeSqlMigrationCoverage', () => {
  test('passes when the native SQL migration covers the schema contract tables, columns, indexes, and rollback boundary', () => {
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage();

    expect(coverage.validation.ok).toBe(true);
    expect(coverage.migrationFilename).toBe('20260701_160000_add_policy_intent_native_storage.sql');
    expect(coverage.tableCoverage.map(tableResult => tableResult.tableId)).toEqual(
      expect.arrayContaining(Object.values(PHASE8R_NATIVE_SCHEMA_TABLE_IDS))
    );
    expect(coverage.tableCoverage.every(tableResult => tableResult.present)).toBe(true);
    expect(coverage.indexCoverage.every(indexResult => indexResult.present)).toBe(true);
    expect(coverage.jsonbShapeChecksPresent).toBe(true);
    expect(coverage.rollbackExpiryBoundaryPresent).toBe(true);
    expect(coverage.forbiddenFieldFindings).toEqual([]);
    expect(coverage.sideEffects).toEqual({
      writesDatabase: false,
      mutatesSchema: false,
      writesFiles: false,
      dropsLegacyStorage: false,
    });
    expect(coverage.nextPhase.phaseId).toBe('8r_10');
  });

  test('rejects missing table and column DDL before treating native storage as covered', () => {
    const migrationSql = readMigrationSql()
      .replace('CREATE TABLE IF NOT EXISTS policy_intent_rules', 'CREATE TABLE IF NOT EXISTS removed_rules')
      .replace('    signal_type VARCHAR(50) NOT NULL,\n', '');
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage({ migrationSql });

    expect(coverage.validation.ok).toBe(false);
    expect(coverage.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_TABLE_DDL,
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_COLUMN_DDL,
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
        columnName: 'signal_type',
      }),
    ]));
  });

  test('rejects missing index DDL declared by the native schema contract', () => {
    const migrationSql = readMigrationSql()
      .replace('CREATE INDEX IF NOT EXISTS idx_policy_intent_rules_values_gin', 'CREATE INDEX IF NOT EXISTS removed_rules_values_gin');
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage({ migrationSql });

    expect(coverage.validation.ok).toBe(false);
    expect(coverage.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_INDEX_DDL,
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
        sqlIndexName: 'idx_policy_intent_rules_values_gin',
      }),
    ]));
  });

  test('rejects legacy, provider, prompt, trace, embedding, and replay fields in executable DDL but ignores comments', () => {
    const migrationSql = `${readMigrationSql()}
-- custom_signals mentioned in a comment is documentation, not executable DDL.
ALTER TABLE policy_intents ADD COLUMN provider_payload JSONB;
ALTER TABLE policy_intents ADD COLUMN embedding vector;`;
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage({ migrationSql });

    expect(coverage.validation.ok).toBe(false);
    expect(coverage.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.FORBIDDEN_LEGACY_FIELD,
        fieldName: 'provider_payload',
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.FORBIDDEN_LEGACY_FIELD,
        fieldName: 'embedding',
      }),
    ]));
    expect(coverage.forbiddenFieldFindings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: 'custom_signals' }),
    ]));
  });

  test('rejects missing JSONB shape checks and unbounded rollback snapshots', () => {
    const migrationSql = readMigrationSql()
      .replace('CONSTRAINT policy_intent_rules_values_shape_chk CHECK (jsonb_typeof(values) = \'object\'),', '')
      .replace('CONSTRAINT policy_intent_rollback_snapshots_window_chk CHECK (expires_at > created_at)', '');
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage({ migrationSql });

    expect(coverage.validation.ok).toBe(false);
    expect(coverage.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_JSONB_SHAPE_CHECK,
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_ROLLBACK_EXPIRY_BOUNDARY,
      }),
    ]));
  });

  test('rejects invalid schema-contract handoffs and side effects', () => {
    const schemaContract = buildPolicyBuilderPhase8NativeSchemaContract({
      tables: listPolicyBuilderPhase8NativeSchemaTables().filter(table =>
        table.tableId !== PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES
      ),
    });
    const coverage = buildPolicyBuilderPhase8NativeSqlMigrationCoverage({ schemaContract });
    const validation = validatePolicyBuilderPhase8NativeSqlMigrationCoverage({
      ...coverage,
      sideEffects: {
        ...coverage.sideEffects,
        writesDatabase: true,
      },
    });

    expect(coverage.validation.ok).toBe(false);
    expect(coverage.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.SCHEMA_CONTRACT_INVALID,
      }),
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        sideEffectId: 'writesDatabase',
      }),
    ]));
  });
});
