import {
  POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS,
  POLICY_NATIVE_SCHEMA_INDEX_IDS,
  POLICY_NATIVE_SCHEMA_SECTION_IDS,
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyNativeSchemaContract,
  buildPolicyNativeSchemaContractAudit,
  listPolicyNativeSchemaTables,
  validatePolicyNativeSchemaContract,
} from '../../services/policyNativeSchemaContract.mjs';

describe('policyNativeSchemaContract', () => {
  test('defines all required native intent storage sections', () => {
    const contract = buildPolicyNativeSchemaContract();

    expect(contract.validation.ok).toBe(true);
    expect(contract.tables.map(table => table.tableId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS,
    ]));
    expect(contract.tables.map(table => table.sectionId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_SCHEMA_SECTION_IDS.HEADER,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.RULES,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.ROUTING_TARGET,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.TEMPLATE_PROVENANCE,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.MIGRATION_EVENTS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.ROLLBACK_SNAPSHOTS,
      POLICY_NATIVE_SCHEMA_SECTION_IDS.VALIDATION_AND_SCHEMA_VERSION,
    ]));
  });

  test('represents declared intent rules without legacy customSignals storage', () => {
    const contract = buildPolicyNativeSchemaContract();
    const rulesTable = contract.tables.find(table =>
      table.tableId === POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES
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
    const contract = buildPolicyNativeSchemaContract();
    const tableById = new Map(contract.tables.map(table => [table.tableId, table]));

    expect(tableById.get(POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'library_id' }),
        expect.objectContaining({ name: 'arr_type' }),
        expect.objectContaining({ name: 'target_status' }),
      ]));
    expect(tableById.get(POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'event_type' }),
        expect.objectContaining({ name: 'actor_type' }),
        expect.objectContaining({ name: 'reason_code' }),
      ]));
    expect(tableById.get(POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'snapshot_payload' }),
        expect.objectContaining({ name: 'expires_at' }),
        expect.objectContaining({ name: 'restore_path' }),
      ]));
    expect(tableById.get(POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS).columns)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'status' }),
        expect.objectContaining({ name: 'validator_version' }),
        expect.objectContaining({ name: 'errors' }),
        expect.objectContaining({ name: 'warnings' }),
      ]));
  });

  test('defines lookup, single-active-policy, jsonb-rule, migration, rollback, and validation indexes', () => {
    const contract = buildPolicyNativeSchemaContract();
    const indexes = contract.tables.flatMap(table => table.indexes);

    expect(indexes.map(index => index.indexId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_SCHEMA_INDEX_IDS.POLICY_LOOKUP,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.LIBRARY_LOOKUP,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_POLICY,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_LOOKUP,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.ROUTING_TARGET_LOOKUP,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.MIGRATION_STATE,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.ROLLBACK_EXPIRY,
      POLICY_NATIVE_SCHEMA_INDEX_IDS.VALIDATION_STATUS,
    ]));

    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        indexId: POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_POLICY,
        columns: ['policy_id'],
        unique: true,
        partialWhere: 'active = true',
      }),
      expect.objectContaining({
        indexId: POLICY_NATIVE_SCHEMA_INDEX_IDS.RULE_VALUES_GIN,
        method: 'gin',
      }),
    ]));
  });

  test('rejects an active unique index that allows different active versions for one policy', () => {
    const tables = listPolicyNativeSchemaTables().map(table =>
      table.tableId === POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS
        ? {
          ...table,
          indexes: table.indexes.map(index =>
            index.indexId === POLICY_NATIVE_SCHEMA_INDEX_IDS.ACTIVE_POLICY
              ? { ...index, columns: ['policy_id', 'intent_version'] }
              : index
          ),
        }
        : table
    );
    const contract = buildPolicyNativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_ACTIVE_UNIQUE_INDEX,
      }),
    ]));
  });

  test('rejects missing required native tables and storage sections', () => {
    const tables = listPolicyNativeSchemaTables()
      .filter(table => table.tableId !== POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES);
    const contract = buildPolicyNativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_TABLE,
        tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      }),
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.MISSING_SECTION,
        sectionId: POLICY_NATIVE_SCHEMA_SECTION_IDS.RULES,
      }),
    ]));
  });

  test('rejects rules that no longer map to the server policy intent contract', () => {
    const tables = listPolicyNativeSchemaTables().map(table =>
      table.tableId === POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES
        ? {
          ...table,
          columns: table.columns.filter(column => column.name !== 'constraint_mode'),
        }
        : table
    );
    const contract = buildPolicyNativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.RULES_NOT_MAPPED_TO_SERVER_CONTRACT,
        columnName: 'constraint_mode',
      }),
    ]));
  });

  test('rejects UI-only, transient, provider, prompt, trace, embedding, and replay diagnostics as durable fields', () => {
    const tables = listPolicyNativeSchemaTables().map(table =>
      table.tableId === POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS
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
    const contract = buildPolicyNativeSchemaContract({ tables });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.FORBIDDEN_DURABLE_FIELD,
        columnName: 'provider_payload',
      }),
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.FORBIDDEN_DURABLE_FIELD,
        columnName: 'embedding',
      }),
    ]));
  });

  test('rejects native activation when server validation is not required', () => {
    const contract = buildPolicyNativeSchemaContract({
      writeGate: {
        serverValidationRequired: false,
      },
    });

    expect(contract.validation.ok).toBe(false);
    expect(contract.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.SERVER_VALIDATION_NOT_REQUIRED,
      }),
    ]));
  });

  test('rejects unbounded rollback snapshots and schema-contract side effects', () => {
    const tables = listPolicyNativeSchemaTables().map(table =>
      table.tableId === POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS
        ? {
          ...table,
          columns: table.columns.filter(column => column.name !== 'expires_at'),
        }
        : table
    );
    const contract = buildPolicyNativeSchemaContract({ tables });
    const mutated = {
      ...contract,
      sideEffects: {
        ...contract.sideEffects,
        tableCreated: true,
      },
    };
    const validation = validatePolicyNativeSchemaContract(mutated);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.ROLLBACK_SNAPSHOT_UNBOUNDED,
      }),
      expect.objectContaining({
        riskId: POLICY_NATIVE_SCHEMA_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('audits cleanly and points to the migration candidate report', () => {
    const contract = buildPolicyNativeSchemaContract();
    const audit = buildPolicyNativeSchemaContractAudit(contract);

    expect(validatePolicyNativeSchemaContract(contract).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      tableCount: 7,
      nextStep: expect.objectContaining({
        stepId: 'migration_candidate_report',
      }),
    }));
  });
});
