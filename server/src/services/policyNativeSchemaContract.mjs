import {
  POLICY_INTENT_COLLECTIONS,
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
  POLICY_INTENT_SOURCES,
  SUPPORTED_POLICY_INTENT_OPERATORS,
  SUPPORTED_POLICY_INTENT_SIGNAL_TYPES,
} from './policyIntentSchema.mjs';

const POLICY_NATIVE_SCHEMA_CONTRACT_VERSION = 'policy.native_schema_contract.v1';

const POLICY_NATIVE_SCHEMA_TABLE_IDS = Object.freeze({
  POLICY_INTENTS: 'policy_intents',
  POLICY_INTENT_RULES: 'policy_intent_rules',
  POLICY_INTENT_ROUTING_TARGETS: 'policy_intent_routing_targets',
  POLICY_INTENT_TEMPLATE_APPLICATIONS: 'policy_intent_template_applications',
  POLICY_INTENT_MIGRATION_EVENTS: 'policy_intent_migration_events',
  POLICY_INTENT_ROLLBACK_SNAPSHOTS: 'policy_intent_rollback_snapshots',
  POLICY_INTENT_VALIDATION_STATUS: 'policy_intent_validation_status',
});

const POLICY_NATIVE_SCHEMA_SECTION_IDS = Object.freeze({
  HEADER: 'header',
  RULES: 'rules',
  ROUTING_TARGET: 'routing_target',
  TEMPLATE_PROVENANCE: 'template_provenance',
  MIGRATION_EVENTS: 'migration_events',
  ROLLBACK_SNAPSHOTS: 'rollback_snapshots',
  VALIDATION_AND_SCHEMA_VERSION: 'validation_and_schema_version',
});

const POLICY_NATIVE_SCHEMA_INDEX_IDS = Object.freeze({
  POLICY_LOOKUP: 'policy_lookup',
  LIBRARY_LOOKUP: 'library_lookup',
  ACTIVE_INTENT_VERSION: 'active_intent_version',
  RULE_LOOKUP: 'rule_lookup',
  RULE_VALUES_GIN: 'rule_values_gin',
  ROUTING_TARGET_LOOKUP: 'routing_target_lookup',
  MIGRATION_STATE: 'migration_state',
  ROLLBACK_EXPIRY: 'rollback_expiry',
  VALIDATION_STATUS: 'validation_status',
});

const POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS = Object.freeze({
  MISSING_TABLE: 'missing_table',
  MISSING_SECTION: 'missing_section',
  MISSING_COLUMN: 'missing_column',
  MISSING_INDEX: 'missing_index',
  MISSING_FOREIGN_KEY: 'missing_foreign_key',
  MISSING_ACTIVE_UNIQUE_INDEX: 'missing_active_unique_index',
  FORBIDDEN_DURABLE_FIELD: 'forbidden_durable_field',
  RULES_NOT_MAPPED_TO_SERVER_CONTRACT: 'rules_not_mapped_to_server_contract',
  INTENT_ENGINE_OUTPUT_NOT_REPRESENTABLE: 'intent_engine_output_not_representable',
  MIGRATION_METADATA_NOT_SEPARATED: 'migration_metadata_not_separated',
  ROLLBACK_SNAPSHOT_UNBOUNDED: 'rollback_snapshot_unbounded',
  SERVER_VALIDATION_NOT_REQUIRED: 'server_validation_not_required',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_TRACE_REASON: 'missing_trace_reason',
});

const TABLE_IDS = Object.freeze(Object.values(POLICY_NATIVE_SCHEMA_TABLE_IDS));
const SECTION_IDS = Object.freeze(Object.values(POLICY_NATIVE_SCHEMA_SECTION_IDS));
const INDEX_IDS = Object.freeze(Object.values(POLICY_NATIVE_SCHEMA_INDEX_IDS));

const FORBIDDEN_DURABLE_FIELD_NAMES = Object.freeze([
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

const REQUIRED_RULE_COLUMNS = Object.freeze([
  'intent_id',
  'intent_role',
  'signal_type',
  'operator',
  'values',
  'constraint_mode',
  'semantics',
  'source',
  'inference_state',
]);

const REQUIRED_HEADER_COLUMNS = Object.freeze([
  'policy_id',
  'library_id',
  'schema_version',
  'intent_version',
  'active',
  'source',
  'inference_state',
  'review_behavior',
  'validation_status',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  return value === true;
}

function column(name, type, options = {}) {
  return {
    name,
    type,
    nullable: options.nullable === true,
    jsonb: type === 'jsonb',
    foreignKey: options.foreignKey || null,
    check: options.check || null,
    default: options.default ?? null,
    durable: options.durable !== false,
  };
}

function index(indexId, columns, options = {}) {
  return {
    indexId,
    columns,
    unique: options.unique === true,
    partialWhere: options.partialWhere || null,
    method: options.method || 'btree',
    purpose: options.purpose || '',
  };
}

function table(tableId, sectionId, columns, indexes, options = {}) {
  return {
    tableId,
    sectionId,
    primaryKey: 'id',
    columns,
    indexes,
    purpose: options.purpose || '',
    migrationOrder: options.migrationOrder,
    traceReasons: options.traceReasons || [`${tableId}_defined`],
  };
}

function listPolicyNativeSchemaTables() {
  return [
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.HEADER,
      [
        column('id', 'bigserial'),
        column('policy_id', 'integer', { foreignKey: 'library_policies(id)' }),
        column('library_id', 'integer', { foreignKey: 'libraries(id)' }),
        column('schema_version', 'integer', {
          default: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
          check: `schema_version = ${POLICY_INTENT_CONTRACT_SCHEMA_VERSION}`,
        }),
        column('intent_version', 'integer', { default: 1 }),
        column('active', 'boolean', { default: true }),
        column('source', 'varchar(40)', {
          check: Object.values(POLICY_INTENT_SOURCES),
        }),
        column('inference_state', 'varchar(40)', {
          check: Object.values(POLICY_INTENT_INFERENCE_STATES),
        }),
        column('review_behavior', 'jsonb'),
        column('validation_status', 'varchar(40)', { default: 'pending_validation' }),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
        column('updated_at', 'timestamp with time zone', { default: 'now()' }),
        column('created_by', 'integer', { nullable: true, foreignKey: 'users(id)' }),
        column('accepted_at', 'timestamp with time zone', { nullable: true }),
        column('accepted_by', 'integer', { nullable: true, foreignKey: 'users(id)' }),
        column('replaced_by_intent_id', 'bigint', {
          nullable: true,
          foreignKey: 'policy_intents(id)',
        }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP, ['policy_id']),
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.LIBRARY_LOOKUP, ['library_id']),
        index(
          POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_INTENT_VERSION,
          ['policy_id', 'intent_version'],
          {
            unique: true,
            partialWhere: 'active = true',
            purpose: 'Only one active native intent version may exist per policy.',
          }
        ),
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS, ['validation_status']),
      ],
      {
        purpose: 'Durable native policy intent header and active version boundary.',
        migrationOrder: 1,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.RULES,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { foreignKey: 'policy_intents(id)' }),
        column('intent_role', 'varchar(40)', { check: Object.values(POLICY_INTENT_ROLES) }),
        column('collection', 'varchar(40)', {
          check: Object.values(POLICY_INTENT_COLLECTIONS),
        }),
        column('signal_type', 'varchar(50)', {
          check: SUPPORTED_POLICY_INTENT_SIGNAL_TYPES,
        }),
        column('operator', 'varchar(50)', {
          check: SUPPORTED_POLICY_INTENT_OPERATORS,
        }),
        column('values', 'jsonb'),
        column('constraint_mode', 'varchar(30)', { nullable: true }),
        column('semantics', 'varchar(30)', { nullable: true }),
        column('source', 'varchar(50)', { nullable: true }),
        column('inference_state', 'varchar(40)', {
          check: Object.values(POLICY_INTENT_INFERENCE_STATES),
        }),
        column('sort_order', 'integer', { default: 0 }),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_LOOKUP, [
          'intent_id',
          'intent_role',
          'signal_type',
        ]),
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN, ['values'], {
          method: 'gin',
          purpose: 'Supports containment queries for bounded native rule values.',
        }),
      ],
      {
        purpose: 'Durable purpose, hard-limit, helpful-hint, and avoid rules.',
        migrationOrder: 2,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.ROUTING_TARGET,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { foreignKey: 'policy_intents(id)' }),
        column('library_id', 'integer', { foreignKey: 'libraries(id)' }),
        column('arr_type', 'varchar(20)', { nullable: true }),
        column('arr_config_id', 'integer', { nullable: true }),
        column('arr_root_folder_id', 'integer', { nullable: true }),
        column('arr_root_folder_path', 'text', { nullable: true }),
        column('quality_profile_id', 'integer', { nullable: true }),
        column('target_status', 'varchar(40)', { default: 'configured' }),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
        column('updated_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.ROUTING_TARGET_LOOKUP, [
          'intent_id',
          'library_id',
          'target_status',
        ]),
      ],
      {
        purpose: 'Native routing target reference separated from rule identity.',
        migrationOrder: 3,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.TEMPLATE_PROVENANCE,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { foreignKey: 'policy_intents(id)' }),
        column('preset_id', 'integer', { nullable: true, foreignKey: 'content_presets(id)' }),
        column('preset_key', 'varchar(100)', { nullable: true }),
        column('preset_name', 'varchar(255)', { nullable: true }),
        column('weight', 'numeric(6,3)', { nullable: true }),
        column('signal_count', 'integer', { default: 0 }),
        column('link_state', 'varchar(40)', { default: 'applied' }),
        column('applied_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP, ['intent_id', 'preset_id']),
      ],
      {
        purpose: 'Starter-template provenance, not durable policy authority by itself.',
        migrationOrder: 4,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.MIGRATION_EVENTS,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { nullable: true, foreignKey: 'policy_intents(id)' }),
        column('policy_id', 'integer', { foreignKey: 'library_policies(id)' }),
        column('event_type', 'varchar(50)'),
        column('actor_type', 'varchar(40)'),
        column('actor_id', 'integer', { nullable: true }),
        column('source_version', 'integer', { nullable: true }),
        column('target_version', 'integer', { nullable: true }),
        column('reason_code', 'varchar(80)'),
        column('summary', 'text', { nullable: true }),
        column('metadata', 'jsonb'),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.MIGRATION_STATE, [
          'policy_id',
          'event_type',
          'created_at',
        ]),
      ],
      {
        purpose: 'Auditable explicit conversion, validation, replacement, and deletion events.',
        migrationOrder: 5,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.ROLLBACK_SNAPSHOTS,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { foreignKey: 'policy_intents(id)' }),
        column('policy_id', 'integer', { foreignKey: 'library_policies(id)' }),
        column('snapshot_version', 'integer'),
        column('snapshot_payload', 'jsonb'),
        column('payload_redacted', 'boolean', { default: true }),
        column('restore_path', 'text'),
        column('expires_at', 'timestamp with time zone'),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
        column('restored_at', 'timestamp with time zone', { nullable: true }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.ROLLBACK_EXPIRY, [
          'policy_id',
          'expires_at',
        ]),
      ],
      {
        purpose: 'Bounded rollback snapshots for migration/rebuild conversion windows.',
        migrationOrder: 6,
      }
    ),
    table(
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.VALIDATION_AND_SCHEMA_VERSION,
      [
        column('id', 'bigserial'),
        column('intent_id', 'bigint', { foreignKey: 'policy_intents(id)' }),
        column('schema_version', 'integer', {
          default: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
        }),
        column('status', 'varchar(40)'),
        column('validator_version', 'varchar(80)'),
        column('error_count', 'integer', { default: 0 }),
        column('warning_count', 'integer', { default: 0 }),
        column('errors', 'jsonb'),
        column('warnings', 'jsonb'),
        column('validated_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      [
        index(POLICY_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS, [
          'intent_id',
          'status',
          'validated_at',
        ]),
      ],
      {
        purpose: 'Server validation result required before native writes become active.',
        migrationOrder: 7,
      }
    ),
  ];
}

function normalizeTable(tableSpec = {}) {
  return {
    tableId: normalizeString(tableSpec.tableId),
    sectionId: normalizeString(tableSpec.sectionId),
    primaryKey: normalizeString(tableSpec.primaryKey),
    purpose: normalizeString(tableSpec.purpose),
    migrationOrder: Number.isFinite(Number(tableSpec.migrationOrder))
      ? Number(tableSpec.migrationOrder)
      : null,
    columns: asArray(tableSpec.columns).map(columnSpec => ({
      ...columnSpec,
      name: normalizeString(columnSpec.name),
      type: normalizeString(columnSpec.type),
      nullable: normalizeBoolean(columnSpec.nullable),
      jsonb: normalizeBoolean(columnSpec.jsonb),
      foreignKey: columnSpec.foreignKey || null,
      durable: columnSpec.durable !== false,
    })),
    indexes: asArray(tableSpec.indexes).map(indexSpec => ({
      ...indexSpec,
      indexId: normalizeString(indexSpec.indexId),
      columns: asArray(indexSpec.columns).map(normalizeString).filter(Boolean),
      unique: normalizeBoolean(indexSpec.unique),
      partialWhere: indexSpec.partialWhere || null,
      method: normalizeString(indexSpec.method) || 'btree',
      purpose: normalizeString(indexSpec.purpose),
    })),
    traceReasons: asArray(tableSpec.traceReasons)
      .map(normalizeString)
      .filter(Boolean)
      .slice(0, 8),
  };
}

function getTable(contract, tableId) {
  return asArray(contract.tables).find(tableSpec => tableSpec.tableId === tableId);
}

function tableHasColumn(tableSpec, columnName) {
  return asArray(tableSpec?.columns).some(columnSpec => columnSpec.name === columnName);
}

function tableHasIndex(contract, indexId) {
  return asArray(contract.tables).some(tableSpec =>
    asArray(tableSpec.indexes).some(indexSpec => indexSpec.indexId === indexId)
  );
}

function tableHasForeignKey(tableSpec, columnName) {
  return asArray(tableSpec?.columns).some(columnSpec =>
    columnSpec.name === columnName && Boolean(columnSpec.foreignKey)
  );
}

function findForbiddenFields(tables) {
  const forbidden = [];
  asArray(tables).forEach(tableSpec => {
    asArray(tableSpec.columns).forEach(columnSpec => {
      if (FORBIDDEN_DURABLE_FIELD_NAMES.includes(columnSpec.name) && columnSpec.durable !== false) {
        forbidden.push({
          tableId: tableSpec.tableId,
          columnName: columnSpec.name,
        });
      }
    });
  });
  return forbidden;
}

function buildPolicyNativeSchemaContract({
  tables = listPolicyNativeSchemaTables(),
  writeGate = {},
} = {}) {
  const normalizedTables = asArray(tables).map(normalizeTable);
  const contract = {
    version: POLICY_NATIVE_SCHEMA_CONTRACT_VERSION,
    sourceContract: {
      policyIntentSchemaVersion: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
      preservesServerValidation: true,
      preservesIntentEngineOutput: true,
      preservesRuntimeVerifierOutput: true,
    },
    tables: normalizedTables,
    forbiddenDurableFields: [...FORBIDDEN_DURABLE_FIELD_NAMES],
    writeGate: {
      serverValidationRequired: writeGate.serverValidationRequired !== false,
      ordinaryReadConversionAllowed: false,
      ordinarySaveConversionAllowed: false,
      migrationRequiredBeforeActivation: true,
    },
    sideEffects: {
      migrationCreated: false,
      tableCreated: false,
      legacyWriteDisabled: false,
      nativeRuntimeEnabled: false,
    },
    summary: {
      tableCount: normalizedTables.length,
      sectionCount: new Set(normalizedTables.map(tableSpec => tableSpec.sectionId)).size,
      jsonbColumnCount: normalizedTables
        .flatMap(tableSpec => tableSpec.columns)
        .filter(columnSpec => columnSpec.jsonb).length,
      forbiddenDurableFieldCount: findForbiddenFields(normalizedTables).length,
    },
    nextStep: {
      stepId: 'migration_candidate_report',
      label: 'Migration Candidate Report',
      reason: 'The native schema boundary is defined, so the next step is a dry-run report that identifies which existing policies can safely convert without mutating storage.',
    },
  };

  return {
    ...contract,
    validation: validatePolicyNativeSchemaContract(contract),
  };
}

function validatePolicyNativeSchemaContract(contract = {}) {
  const issues = [];
  const tables = asArray(contract.tables);
  const tableIds = new Set(tables.map(tableSpec => tableSpec.tableId));
  const sectionIds = new Set(tables.map(tableSpec => tableSpec.sectionId));

  TABLE_IDS.forEach(tableId => {
    if (!tableIds.has(tableId)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_TABLE,
        tableId,
        message: 'Native schema contract is missing a required table.',
      });
    }
  });

  SECTION_IDS.forEach(sectionId => {
    if (!sectionIds.has(sectionId)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_SECTION,
        sectionId,
        message: 'Native schema contract is missing a required storage section.',
      });
    }
  });

  const headerTable = getTable(contract, POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS);
  REQUIRED_HEADER_COLUMNS.forEach(columnName => {
    if (!tableHasColumn(headerTable, columnName)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_COLUMN,
        tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
        columnName,
        message: 'Native intent header is missing a required contract column.',
      });
    }
  });

  const rulesTable = getTable(contract, POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES);
  REQUIRED_RULE_COLUMNS.forEach(columnName => {
    if (!tableHasColumn(rulesTable, columnName)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.RULES_NOT_MAPPED_TO_SERVER_CONTRACT,
        tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
        columnName,
        message: 'Native intent rules do not map directly to the server policy intent contract.',
      });
    }
  });

  [
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS, 'policy_id'],
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS, 'library_id'],
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES, 'intent_id'],
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS, 'intent_id'],
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS, 'intent_id'],
    [POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS, 'intent_id'],
  ].forEach(([tableId, columnName]) => {
    if (!tableHasForeignKey(getTable(contract, tableId), columnName)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_FOREIGN_KEY,
        tableId,
        columnName,
        message: 'Native schema contract is missing a required referential boundary.',
      });
    }
  });

  INDEX_IDS.forEach(indexId => {
    if (!tableHasIndex(contract, indexId)) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_INDEX,
        indexId,
        message: 'Native schema contract is missing a required lookup or safety index.',
      });
    }
  });

  const activeIndex = asArray(headerTable?.indexes).find(indexSpec =>
    indexSpec.indexId === POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_INTENT_VERSION
  );
  if (!activeIndex?.unique || activeIndex.partialWhere !== 'active = true') {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_ACTIVE_UNIQUE_INDEX,
      message: 'Native schema must enforce one active native intent version per policy.',
    });
  }

  findForbiddenFields(tables).forEach(forbidden => {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.FORBIDDEN_DURABLE_FIELD,
      ...forbidden,
      message: 'Native durable intent storage cannot include UI-only or transient diagnostic fields.',
    });
  });

  const routingTable = getTable(contract, POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS);
  if (!routingTable || !tableHasColumn(routingTable, 'library_id')) {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.INTENT_ENGINE_OUTPUT_NOT_REPRESENTABLE,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      message: 'destination/readiness engine output requires a native routing target reference.',
    });
  }

  const migrationTable = getTable(contract, POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS);
  if (!migrationTable || !tableHasColumn(migrationTable, 'event_type')) {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MIGRATION_METADATA_NOT_SEPARATED,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
      message: 'Migration metadata must be stored outside durable intent rules.',
    });
  }

  const rollbackTable = getTable(contract, POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS);
  if (!tableHasColumn(rollbackTable, 'expires_at')) {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.ROLLBACK_SNAPSHOT_UNBOUNDED,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      message: 'Rollback snapshots must have an expiration boundary.',
    });
  }

  if (contract.writeGate?.serverValidationRequired !== true) {
    issues.push({
      riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.SERVER_VALIDATION_NOT_REQUIRED,
      message: 'Native writes must require server validation before activation.',
    });
  }

  tables.forEach(tableSpec => {
    if (asArray(tableSpec.traceReasons).length === 0) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
        tableId: tableSpec.tableId,
        message: 'Each native schema table decision must include a bounded trace reason.',
      });
    }
  });

  Object.entries(contract.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Native schema contract cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyNativeSchemaContractAudit(
  contract = buildPolicyNativeSchemaContract()
) {
  const validation = validatePolicyNativeSchemaContract(contract);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    tableCount: asArray(contract.tables).length,
    sectionCount: new Set(asArray(contract.tables).map(tableSpec => tableSpec.sectionId)).size,
    validation,
    nextStep: contract.nextStep || {
      stepId: 'migration_candidate_report',
      label: 'Migration Candidate Report',
      reason: 'Native schema is defined; conversion readiness can now be reported without writing.',
    },
  };
}

export {
  POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS,
  POLICY_NATIVE_SCHEMA_CONTRACT_VERSION,
  POLICY_NATIVE_SCHEMA_INDEX_IDS,
  POLICY_NATIVE_SCHEMA_SECTION_IDS,
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyNativeSchemaContract,
  buildPolicyNativeSchemaContractAudit,
  listPolicyNativeSchemaTables,
  validatePolicyNativeSchemaContract,
};
