import {
  PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS,
  PHASE8R_NATIVE_SCHEMA_INDEX_IDS,
  PHASE8R_NATIVE_SCHEMA_SECTION_IDS,
  PHASE8R_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyBuilderPhase8NativeSchemaContract,
  buildPolicyBuilderPhase8NativeSchemaContractAudit,
  listPolicyBuilderPhase8NativeSchemaTables,
  validatePolicyBuilderPhase8NativeSchemaContract,
} from '../../services/policyBuilderPhase8NativeSchemaContract.mjs';

describe('policyBuilderPhase8NativeSchemaContract', () => {
  test('defines all required native intent storage sections', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract();

    expect(contract.validation.ok).toBe(true);
    expect(contract.tables.map(table => table.tableId)).toEqual(expect.arrayContaining([
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS,
    ]));
    expect(contract.tables.map(table => table.sectionId)).toEqual(expect.arrayContaining([
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.HEADER,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.RULES,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.ROUTING_TARGET,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.TEMPLATE_PROVENANCE,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.MIGRATION_EVENTS,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.ROLLBACK_SNAPSHOTS,
      PHASE8R_NATIVE_SCHEMA_SECTION_IDS.VALIDATION_AND_SCHEMA_VERSION,
    ]));
  });

  test('represents declared intent rules without legacy customSignals storage', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract();
    const rulesTable = contract.tables.find(table =>
      table.tableId === PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES
    );
    const columnNames = rulesTable.columns.map(column => column.name);

    expect(columnNames).toEqual(expect.arrayContaining([
      'intent_role',
      'collection',
      'signal_type',
      'operator',
      'values',
      'constraint_mode',
      'semantics',
      'source',
      'inference_state',
    ]));
    expect(columnNames).not.toEqual(expect.arrayContaining([
      'custom_signals',
      'customSignals',
      'preset_payload',
    ]));
  });

  test('separates durable policy intent from routing, migration, rollback, and validation metadata', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract();
    const tableById = new Map(contract.tables.map(table => [table.tableId, table]));

    expect(tableById.get(PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'library_id' }),
        expect.objectContaining({ name: 'arr_type' }),
        expect.objectContaining({ name: 'target_status' }),
      ]));
    expect(tableById.get(PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'event_type' }),
        expect.objectContaining({ name: 'actor_type' }),
        expect.objectContaining({ name: 'reason_code' }),
      ]));
    expect(tableById.get(PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'snapshot_payload' }),
        expect.objectContaining({ name: 'expires_at' }),
        expect.objectContaining({ name: 'restore_path' }),
      ]));
    expect(tableById.get(PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'status' }),
        expect.objectContaining({ name: 'validator_version' }),
        expect.objectContaining({ name: 'errors' }),
        expect.objectContaining({ name: 'warnings' }),
      ]));
  });

  test('defines lookup, active-version, jsonb-rule, migration, rollback, and validation indexes', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract();
    const indexes = contract.tables.flatMap(table => table.indexes);

    expect(indexes.map(index => index.indexId)).toEqual(expect.arrayContaining([
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.LIBRARY_LOOKUP,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_INTENT_VERSION,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.RULE_LOOKUP,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.ROUTING_TARGET_LOOKUP,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.MIGRATION_STATE,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.ROLLBACK_EXPIRY,
      PHASE8R_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS,
    ]));

    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        indexId: PHASE8R_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_INTENT_VERSION,
        unique: true,
        partialWhere: 'active = true',
      }),
      expect.objectContaining({
        indexId: PHASE8R_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN,
        method: 'gin',
      }),
    ]));
  });

  test('rejects missing required native tables and storage sections', () => {
    const tables = listPolicyBuilderPhase8NativeSchemaTables()
      .filter(table => table.tableId !== PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES);
    const contract = buildPolicyBuilderPhase8NativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_TABLE,
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_SECTION,
        sectionId: PHASE8R_NATIVE_SCHEMA_SECTION_IDS.RULES,
      }),
    ]));
  });

  test('rejects rules that no longer map to the Phase 5R server contract', () => {
    const tables = listPolicyBuilderPhase8NativeSchemaTables().map(table =>
      table.tableId === PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES
        ? {
          ...table,
          columns: table.columns.filter(column => column.name !== 'constraint_mode'),
        }
        : table
    );
    const contract = buildPolicyBuilderPhase8NativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.RULES_NOT_MAPPED_TO_PHASE5_CONTRACT,
        columnName: 'constraint_mode',
      }),
    ]));
  });

  test('rejects UI-only, transient, provider, prompt, trace, embedding, and replay diagnostics as durable fields', () => {
    const tables = listPolicyBuilderPhase8NativeSchemaTables().map(table =>
      table.tableId === PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS
        ? {
          ...table,
          columns: [
            ...table.columns,
            {
              name: 'provider_payload',
              type: 'jsonb',
              jsonb: true,
              durable: true,
            },
            {
              name: 'embedding',
              type: 'vector',
              durable: true,
            },
          ],
        }
        : table
    );
    const contract = buildPolicyBuilderPhase8NativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.FORBIDDEN_DURABLE_FIELD,
        columnName: 'provider_payload',
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.FORBIDDEN_DURABLE_FIELD,
        columnName: 'embedding',
      }),
    ]));
  });

  test('rejects native activation when server validation is not required', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract({
      writeGate: {
        serverValidationRequired: false,
      },
    });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.SERVER_VALIDATION_NOT_REQUIRED,
      }),
    ]));
  });

  test('rejects unbounded rollback snapshots and schema-contract side effects', () => {
    const tables = listPolicyBuilderPhase8NativeSchemaTables().map(table =>
      table.tableId === PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS
        ? {
          ...table,
          columns: table.columns.filter(column => column.name !== 'expires_at'),
        }
        : table
    );
    const contract = buildPolicyBuilderPhase8NativeSchemaContract({ tables });
    const mutated = {
      ...contract,
      sideEffects: {
        ...contract.sideEffects,
        tableCreated: true,
      },
    };
    const validation = validatePolicyBuilderPhase8NativeSchemaContract(mutated);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.ROLLBACK_SNAPSHOT_UNBOUNDED,
      }),
      expect.objectContaining({
        riskId: PHASE8R_NATIVE_SCHEMA_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('audits cleanly and points to the migration candidate report', () => {
    const contract = buildPolicyBuilderPhase8NativeSchemaContract();
    const audit = buildPolicyBuilderPhase8NativeSchemaContractAudit(contract);

    expect(validatePolicyBuilderPhase8NativeSchemaContract(contract).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      tableCount: 7,
      nextPhase: expect.objectContaining({
        phaseId: '8r_2',
      }),
    }));
  });
});
