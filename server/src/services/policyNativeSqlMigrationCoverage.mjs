import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  POLICY_NATIVE_SCHEMA_INDEX_IDS,
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyNativeSchemaContract,
  validatePolicyNativeSchemaContract,
} from './policyNativeSchemaContract.mjs';

const POLICY_NATIVE_SQL_MIGRATION_COVERAGE_VERSION =
  'policy.native_sql_migration_coverage.v1';

const POLICY_NATIVE_SQL_MIGRATION_FILENAME =
  '20260701_160000_add_policy_intent_native_storage.sql';

const POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_FILENAME =
  '20260713_150000_enforce_single_active_policy_intent.sql';

const POLICY_NATIVE_SQL_MIGRATION_PATH = path.resolve(
  import.meta.dirname,
  '../../../database/migrations',
  POLICY_NATIVE_SQL_MIGRATION_FILENAME
);

const POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_PATH = path.resolve(
  import.meta.dirname,
  '../../../database/migrations',
  POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_FILENAME
);

const POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS = Object.freeze({
  MISSING_MIGRATION_FILE: 'missing_migration_file',
  EMPTY_MIGRATION_SQL: 'empty_migration_sql',
  SCHEMA_CONTRACT_INVALID: 'schema_contract_invalid',
  MISSING_TABLE_DDL: 'missing_table_ddl',
  MISSING_COLUMN_DDL: 'missing_column_ddl',
  MISSING_INDEX_DDL: 'missing_index_ddl',
  MISSING_JSONB_SHAPE_CHECK: 'missing_jsonb_shape_check',
  MISSING_ROLLBACK_EXPIRY_BOUNDARY: 'missing_rollback_expiry_boundary',
  FORBIDDEN_LEGACY_FIELD: 'forbidden_legacy_field',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const POLICY_NATIVE_SQL_MIGRATION_COVERAGE_REASON_IDS = Object.freeze({
  CANONICAL_MIGRATION_FILE_READ: 'canonical_migration_file_read',
  SCHEMA_CONTRACT_COMPARED: 'schema_contract_compared',
  TABLES_AND_COLUMNS_COVERED: 'tables_and_columns_covered',
  INDEXES_COVERED: 'indexes_covered',
  ROLLBACK_WINDOW_BOUNDED: 'rollback_window_bounded',
  LEGACY_FIELDS_EXCLUDED: 'legacy_fields_excluded',
});

const EXPECTED_INDEX_SQL_NAMES = Object.freeze({
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_POLICY}`]:
    'idx_policy_intents_one_active_policy',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP}`]:
    'idx_policy_intents_policy_lookup',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.LIBRARY_LOOKUP}`]:
    'idx_policy_intents_library_lookup',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS}`]:
    'idx_policy_intents_validation_status',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_LOOKUP}`]:
    'idx_policy_intent_rules_lookup',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN}`]:
    'idx_policy_intent_rules_values_gin',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.ROUTING_TARGET_LOOKUP}`]:
    'idx_policy_intent_routing_targets_lookup',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP}`]:
    'idx_policy_intent_template_applications_lookup',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.MIGRATION_STATE}`]:
    'idx_policy_intent_migration_events_state',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.ROLLBACK_EXPIRY}`]:
    'idx_policy_intent_rollback_snapshots_expiry',
  [`${POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS}:${POLICY_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS}`]:
    'idx_policy_intent_validation_status_lookup',
});

const FORBIDDEN_NATIVE_SQL_FIELDS = Object.freeze([
  'custom_signals',
  'customSignals',
  'preset_payload',
  'ui_draft_state',
  'draft_state',
  'transient_readiness',
  'readiness_preview',
  'provider_payload',
  'raw_provider_payload',
  'prompt',
  'prompts',
  'trace',
  'traces',
  'embedding',
  'embeddings',
  'replay_diagnostics',
  'impact_preview',
  'replay_preview',
  'raw_replay_payload',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readCanonicalMigrationSql() {
  if (!existsSync(POLICY_NATIVE_SQL_MIGRATION_PATH)) {
    return null;
  }

  return readFileSync(POLICY_NATIVE_SQL_MIGRATION_PATH, 'utf8');
}

function readActiveIntentIntegrityMigrationSql() {
  if (!existsSync(POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_PATH)) {
    return null;
  }

  return readFileSync(POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_PATH, 'utf8');
}

function stripSqlLineComments(sql) {
  return normalizeString(sql)
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

function normalizeSqlLine(line) {
  return normalizeString(line)
    .replaceAll('"', '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function hasCreateTableStatement(migrationSql, tableId) {
  const expectedPrefix = `create table if not exists ${tableId.toLowerCase()} `;

  return migrationSql
    .split('\n')
    .some(line => normalizeSqlLine(line).startsWith(expectedPrefix));
}

function hasColumnStatement(tableBlock, columnName) {
  const expectedPrefix = `${columnName.toLowerCase()} `;

  return tableBlock
    .split('\n')
    .some(line => normalizeSqlLine(line).startsWith(expectedPrefix));
}

function hasCreateIndexStatement(migrationSql, indexName) {
  const normalizedIndexName = indexName.toLowerCase();

  return migrationSql
    .split('\n')
    .some(line => {
      const normalizedLine = normalizeSqlLine(line);
      const isCreateIndex = normalizedLine.startsWith('create index ')
        || normalizedLine.startsWith('create unique index ');
      return isCreateIndex && normalizedLine.includes(` ${normalizedIndexName}`);
    });
}

function getTableBlock(migrationSql, tableId) {
  const lines = migrationSql.split('\n');
  const startIndex = lines.findIndex(line =>
    normalizeSqlLine(line).startsWith(`create table if not exists ${tableId.toLowerCase()} `)
  );

  if (startIndex === -1) {
    return '';
  }

  const blockLines = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    blockLines.push(lines[index]);

    if (normalizeSqlLine(lines[index]) === ');') {
      break;
    }
  }

  return blockLines.join('\n');
}

function buildTableCoverage(contractTables, migrationSql) {
  return contractTables.map(tableSpec => {
    const block = getTableBlock(migrationSql, tableSpec.tableId);
    const columnCoverage = asArray(tableSpec.columns).map(columnSpec => ({
      columnName: columnSpec.name,
      present: hasColumnStatement(block, columnSpec.name),
    }));

    return {
      tableId: tableSpec.tableId,
      present: hasCreateTableStatement(migrationSql, tableSpec.tableId),
      columnCoverage,
      missingColumns: columnCoverage
        .filter(columnResult => !columnResult.present)
        .map(columnResult => columnResult.columnName),
    };
  });
}

function buildIndexCoverage(contractTables, migrationSql) {
  return contractTables.flatMap(tableSpec =>
    asArray(tableSpec.indexes).map(indexSpec => {
      const lookupKey = `${tableSpec.tableId}:${indexSpec.indexId}`;
      const sqlIndexName = EXPECTED_INDEX_SQL_NAMES[lookupKey] || '';

      return {
        tableId: tableSpec.tableId,
        indexId: indexSpec.indexId,
        sqlIndexName,
        present: Boolean(sqlIndexName) && hasCreateIndexStatement(migrationSql, sqlIndexName),
      };
    })
  );
}

function buildForbiddenFieldFindings(migrationSql) {
  const normalizedSql = migrationSql.toLowerCase();

  return FORBIDDEN_NATIVE_SQL_FIELDS
    .filter(fieldName => normalizedSql.includes(fieldName.toLowerCase()))
    .map(fieldName => ({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.FORBIDDEN_LEGACY_FIELD,
      fieldName,
      message: `Native intent SQL migration must not create durable legacy/transient field "${fieldName}".`,
    }));
}

function hasRollbackExpiryBoundary(migrationSql) {
  return /policy_intent_rollback_snapshots_window_chk/i.test(migrationSql)
    && /CHECK\s*\(\s*expires_at\s*>\s*created_at\s*\)/i.test(migrationSql);
}

function hasJsonbShapeChecks(migrationSql) {
  return [
    'policy_intents_review_behavior_shape_chk',
    'policy_intent_rules_values_shape_chk',
    'policy_intent_migration_events_metadata_shape_chk',
    'policy_intent_rollback_snapshots_payload_shape_chk',
    'policy_intent_validation_status_errors_shape_chk',
    'policy_intent_validation_status_warnings_shape_chk',
  ].every(constraintName => migrationSql.includes(constraintName));
}

function validatePolicyNativeSqlMigrationCoverage(coverage = {}) {
  const issues = [];

  if (coverage.migrationFileExists !== true) {
    issues.push({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_MIGRATION_FILE,
      migrationPath: coverage.migrationPath,
      message: 'Canonical native policy intent SQL migration file must exist.',
    });
  }

  if (normalizeString(coverage.migrationSql).length === 0) {
    issues.push({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.EMPTY_MIGRATION_SQL,
      migrationPath: coverage.migrationPath,
      message: 'Native policy intent SQL migration must not be empty.',
    });
  }

  if (coverage.schemaContractValidation?.ok !== true) {
    issues.push({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.SCHEMA_CONTRACT_INVALID,
      message: 'Native SQL migration coverage cannot pass when the schema contract is invalid.',
      contractIssues: asArray(coverage.schemaContractValidation?.issues),
    });
  }

  asArray(coverage.tableCoverage).forEach(tableResult => {
    if (tableResult.present !== true) {
      issues.push({
        riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_TABLE_DDL,
        tableId: tableResult.tableId,
        message: `Native SQL migration is missing table DDL for ${tableResult.tableId}.`,
      });
    }

    asArray(tableResult.missingColumns).forEach(columnName => {
      issues.push({
        riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_COLUMN_DDL,
        tableId: tableResult.tableId,
        columnName,
        message: `Native SQL migration is missing column ${tableResult.tableId}.${columnName}.`,
      });
    });
  });

  asArray(coverage.indexCoverage)
    .filter(indexResult => indexResult.present !== true)
    .forEach(indexResult => {
      issues.push({
        riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_INDEX_DDL,
        tableId: indexResult.tableId,
        indexId: indexResult.indexId,
        sqlIndexName: indexResult.sqlIndexName,
        message: `Native SQL migration is missing index coverage for ${indexResult.tableId}:${indexResult.indexId}.`,
      });
    });

  if (coverage.jsonbShapeChecksPresent !== true) {
    issues.push({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_JSONB_SHAPE_CHECK,
      message: 'Native SQL migration must constrain JSONB columns to expected object/array shapes.',
    });
  }

  if (coverage.rollbackExpiryBoundaryPresent !== true) {
    issues.push({
      riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.MISSING_ROLLBACK_EXPIRY_BOUNDARY,
      message: 'Native rollback snapshots must enforce expires_at > created_at.',
    });
  }

  issues.push(...asArray(coverage.forbiddenFieldFindings));

  Object.entries(coverage.sideEffects || {}).forEach(([sideEffectId, performed]) => {
    if (performed === true) {
      issues.push({
        riskId: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        sideEffectId,
        message: `Native SQL migration coverage audit cannot perform side effect "${sideEffectId}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyNativeSqlMigrationCoverage(options = {}) {
  const schemaContract = options.schemaContract || buildPolicyNativeSchemaContract();
  const schemaContractValidation = validatePolicyNativeSchemaContract(schemaContract);
  const baseMigrationSql = options.baseMigrationSql ?? readCanonicalMigrationSql() ?? '';
  const integrityMigrationSql = options.integrityMigrationSql
    ?? readActiveIntentIntegrityMigrationSql()
    ?? '';
  const migrationFileExists = options.migrationSql
    ? true
    : existsSync(POLICY_NATIVE_SQL_MIGRATION_PATH)
      && existsSync(POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_PATH);
  const migrationSql = options.migrationSql ?? `${baseMigrationSql}\n${integrityMigrationSql}`;
  const migrationDdlSql = stripSqlLineComments(migrationSql);
  const tables = asArray(schemaContract.tables);
  const tableCoverage = buildTableCoverage(tables, migrationDdlSql);
  const indexCoverage = buildIndexCoverage(tables, migrationDdlSql);

  const coverage = {
    version: POLICY_NATIVE_SQL_MIGRATION_COVERAGE_VERSION,
    migrationFilename: POLICY_NATIVE_SQL_MIGRATION_FILENAME,
    migrationPath: POLICY_NATIVE_SQL_MIGRATION_PATH,
    integrityMigrationFilename: POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_FILENAME,
    integrityMigrationPath: POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_PATH,
    migrationFileExists,
    migrationSql,
    migrationDdlSql,
    schemaContractVersion: schemaContract.version,
    schemaContractValidation,
    tableCoverage,
    indexCoverage,
    jsonbShapeChecksPresent: hasJsonbShapeChecks(migrationDdlSql),
    rollbackExpiryBoundaryPresent: hasRollbackExpiryBoundary(migrationDdlSql),
    forbiddenFieldFindings: buildForbiddenFieldFindings(migrationDdlSql),
    traceReasons: Object.values(POLICY_NATIVE_SQL_MIGRATION_COVERAGE_REASON_IDS),
    sideEffects: {
      writesDatabase: false,
      mutatesSchema: false,
      writesFiles: false,
      dropsLegacyStorage: false,
    },
  };

  return {
    ...coverage,
    validation: validatePolicyNativeSqlMigrationCoverage(coverage),
    nextStep: {
      stepId: 'native_storage_operational_wiring',
      label: 'Native Storage Operational Wiring',
      reason:
        'Native SQL storage coverage is now tied to the schema contract; operational recovery wiring remains the next live-storage risk.',
    },
  };
}

export {
  POLICY_NATIVE_SQL_MIGRATION_COVERAGE_REASON_IDS,
  POLICY_NATIVE_SQL_MIGRATION_COVERAGE_RISK_IDS,
  POLICY_NATIVE_SQL_MIGRATION_COVERAGE_VERSION,
  POLICY_NATIVE_ACTIVE_INTENT_INTEGRITY_MIGRATION_FILENAME,
  POLICY_NATIVE_SQL_MIGRATION_FILENAME,
  buildPolicyNativeSqlMigrationCoverage,
  validatePolicyNativeSqlMigrationCoverage,
};
