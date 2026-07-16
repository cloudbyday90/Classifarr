import { jest } from '@jest/globals';

import {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS,
} from '../../services/policyInitialIntentEstablishmentReadinessContract.mjs';
import {
  getPolicyInitialIntentEstablishmentReadiness,
} from '../../services/policyInitialIntentEstablishmentReadinessService.mjs';

const NOW = '2026-07-16T18:00:00.000Z';

function baseRecord(overrides = {}) {
  return {
    policy_id: 44,
    library_id: 6,
    preset_attachment_count: 0,
    override_count: 0,
    native_intent_count: 0,
    active_native_intent_count: 0,
    establishment_id: null,
    establishment_state: null,
    established_intent_id: null,
    rollback_snapshot_id: null,
    established_at: null,
    established_intent_active: null,
    rollback_expires_at: null,
    rollback_restored_at: null,
    rollback_payload_redacted: null,
    ...overrides,
  };
}

function declaredPurposeRule(overrides = {}) {
  return {
    collection: 'purpose',
    intent_role: 'purpose',
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation'] },
    constraint_mode: null,
    semantics: 'identity',
    sort_order: 0,
    ...overrides,
  };
}

function createDb({ record = baseRecord(), rules = [], throwOnRead = false } = {}) {
  return {
    query: jest.fn(async sql => {
      if (throwOnRead) {
        throw new Error('database connection detail');
      }

      const statement = String(sql);
      if (statement.includes('FROM library_policies policy')) {
        return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
      }
      if (statement.includes('FROM policy_intent_rules')) {
        return { rows: rules, rowCount: rules.length };
      }

      throw new Error(`Unexpected query: ${statement}`);
    }),
  };
}

describe('policyInitialIntentEstablishmentReadinessService', () => {
  test('reports a clean first-establishment decision from bounded counts only', async () => {
    const dbClient = createDb();

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READY,
      policyId: 44,
      eligibility: {
        canEstablishInitialIntent: true,
        blockers: [],
      },
      legacyConfiguration: {
        presetAttachmentCount: 0,
        overrideCount: 0,
      },
      nativeIntentHistory: {
        count: 0,
        activeCount: 0,
      },
      sideEffects: {
        readOnly: true,
        automationStarted: false,
      },
    }));
    expect(dbClient.query.mock.calls.map(([sql]) => String(sql)).join('\n'))
      .not.toMatch(/\b(?:INSERT|UPDATE|DELETE|FOR UPDATE)\b/i);
  });

  test('reports configured legacy attachments as a blocker without loading their payloads', async () => {
    const dbClient = createDb({
      record: baseRecord({ preset_attachment_count: 2, override_count: 1 }),
    });

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.LEGACY_CONFIGURATION_PRESENT);
    expect(result.eligibility).toEqual({
      canEstablishInitialIntent: false,
      blockers: [expect.objectContaining({ riskId: 'legacy_configuration_present' })],
    });
    expect(JSON.stringify(result)).not.toContain('custom_signals');
  });

  test('reports active native authority as a blocker instead of treating it as a first-establishment candidate', async () => {
    const dbClient = createDb({
      record: baseRecord({ native_intent_count: 2, active_native_intent_count: 1 }),
    });

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.ACTIVE_NATIVE_INTENT);
    expect(result.eligibility.blockers[0].riskId).toBe('active_native_intent');
  });

  test('returns a validated declared-rule summary and reversible establishment history without secrets', async () => {
    const dbClient = createDb({
      record: baseRecord({
        native_intent_count: 1,
        active_native_intent_count: 1,
        establishment_id: 51,
        establishment_state: 'established',
        established_intent_id: 101,
        rollback_snapshot_id: 301,
        established_at: '2026-07-16T17:00:00.000Z',
        established_intent_active: true,
        rollback_expires_at: '2026-07-30T17:00:00.000Z',
        rollback_restored_at: null,
        rollback_payload_redacted: false,
        idempotency_key: 'never-read',
        request_fingerprint: 'never-read',
        accepted_by: 7,
        snapshot_payload: { never: 'read' },
      }),
      rules: [
        declaredPurposeRule(),
        declaredPurposeRule({
          collection: 'avoid',
          intent_role: 'avoid',
          signal_type: 'certifications',
          operator: 'exclude',
          values: { exclude: ['NC-17'] },
          semantics: null,
          sort_order: 1,
        }),
      ],
    });

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.ESTABLISHED);
    expect(result.establishmentHistory).toEqual(expect.objectContaining({
      stateId: 'established',
      idempotencyStateId: 'recorded',
      establishment: {
        id: 51,
        intentId: 101,
        establishedAt: '2026-07-16T17:00:00.000Z',
        authoritySourceId: 'operator_declared_intent',
      },
      recovery: expect.objectContaining({
        stateId: POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.ROLLBACK_AVAILABLE,
        rollbackAvailable: true,
        snapshotId: 301,
      }),
    }));
    expect(result.declaredRuleSummary).toEqual({
      stateId: 'available',
      ruleCount: 2,
      declaredIntent: {
        purpose: [{
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          constraint_mode: null,
          semantics: 'identity',
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [{
          signal_type: 'certifications',
          operator: 'exclude',
          values: { exclude: ['NC-17'] },
          constraint_mode: null,
          semantics: null,
        }],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('never-read');
    expect(serialized).not.toContain('accepted_by');
    expect(serialized).not.toContain('snapshot_payload');
  });

  test('marks an established but restored policy as reverted and permanently ineligible for another first establishment', async () => {
    const dbClient = createDb({
      record: baseRecord({
        native_intent_count: 1,
        active_native_intent_count: 0,
        establishment_id: 51,
        establishment_state: 'established',
        established_intent_id: 101,
        rollback_snapshot_id: 301,
        established_at: '2026-07-16T17:00:00.000Z',
        established_intent_active: false,
        rollback_expires_at: '2026-07-30T17:00:00.000Z',
        rollback_restored_at: '2026-07-16T19:00:00.000Z',
        rollback_payload_redacted: false,
      }),
      rules: [declaredPurposeRule()],
    });

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.REVERTED);
    expect(result.eligibility.canEstablishInitialIntent).toBe(false);
    expect(result.establishmentHistory.stateId).toBe('reverted');
    expect(result.establishmentHistory.recovery.stateId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_RECOVERY_STATE_IDS.REVERTED);
  });

  test('fails closed when persisted declared rules cannot be validated', async () => {
    const dbClient = createDb({
      record: baseRecord({
        native_intent_count: 1,
        active_native_intent_count: 1,
        establishment_id: 51,
        establishment_state: 'established',
        established_intent_id: 101,
        rollback_snapshot_id: 301,
        established_at: '2026-07-16T17:00:00.000Z',
        established_intent_active: true,
        rollback_expires_at: '2026-07-30T17:00:00.000Z',
        rollback_payload_redacted: false,
      }),
      rules: [declaredPurposeRule({ intent_role: 'helpful_hint' })],
    });

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient,
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.RECOVERY_ATTENTION_REQUIRED);
    expect(result.declaredRuleSummary).toEqual({
      stateId: 'invalid',
      ruleCount: 0,
      declaredIntent: null,
    });
    expect(result.eligibility.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'declared_rule_summary_invalid' }),
    ]));
  });

  test('returns a generic unavailable result without database error detail', async () => {
    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient: createDb({ throwOnRead: true }),
      policyId: 44,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READ_UNAVAILABLE);
    expect(JSON.stringify(result)).not.toContain('database connection detail');
  });
});
