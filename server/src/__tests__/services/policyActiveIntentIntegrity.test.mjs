import { jest } from '@jest/globals';
import {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
  buildPolicyActiveIntentIntegrityReport,
  loadPolicyActiveIntentIntegrityReport,
} from '../../services/policyActiveIntentIntegrity.mjs';

describe('policyActiveIntentIntegrity', () => {
  test('reports a clean state without side effects when every policy has one active intent', () => {
    const report = buildPolicyActiveIntentIntegrityReport({
      activeIntents: [{ id: 1, policy_id: 10, intent_version: 1, validation_status: 'valid' }],
    });

    expect(report.statusId).toBe(POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.CLEAN);
    expect(report.duplicatePolicyCount).toBe(0);
    expect(report.sideEffects).toEqual({
      writesDatabase: false,
      mutatesSchema: false,
      writesFiles: false,
      deletesIntentPayloads: false,
    });
  });

  test('chooses a valid candidate before a newer invalid candidate and preserves every duplicate id', () => {
    const report = buildPolicyActiveIntentIntegrityReport({
      activeIntents: [
        { id: 11, policy_id: 10, intent_version: 1, validation_status: 'valid' },
        { id: 12, policy_id: 10, intent_version: 2, validation_status: 'invalid' },
        { id: 13, policy_id: 10, intent_version: 3, validation_status: 'warning' },
      ],
    });

    expect(report.statusId).toBe(POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE);
    expect(report.findings).toEqual([expect.objectContaining({
      policyId: 10,
      canonicalIntentId: 11,
      canonicalIntentVersion: 1,
      duplicateIntentIds: [12, 13],
    })]);
  });

  test('chooses the highest safe version and uses timestamps then id as deterministic ties', () => {
    const report = buildPolicyActiveIntentIntegrityReport({
      activeIntents: [
        { id: 12, policy_id: 10, intent_version: 2, validation_status: 'valid' },
        { id: 11, policy_id: 10, intent_version: 2, validation_status: 'valid', updated_at: '2026-07-01T00:00:00.000Z' },
        { id: 10, policy_id: 10, intent_version: 1, validation_status: 'valid' },
      ],
    });

    expect(report.findings[0]).toEqual(expect.objectContaining({
      canonicalIntentId: 11,
      duplicateIntentIds: [10, 12],
    }));
  });

  test('breaks authority ties with the exact intent ID and sorts IDs in numeric order', () => {
    const rows = ['9007199254740992', '9007199254740993', '9007199254740991'].map(id => ({
      id, policy_id: 10, intent_version: 1, validation_status: 'valid',
    }));
    const report = buildPolicyActiveIntentIntegrityReport({ activeIntents: rows });

    expect(report.findings[0]).toMatchObject({
      activeIntentCount: 3,
      canonicalIntentId: '9007199254740993',
      activeIntentIds: [9007199254740991, '9007199254740992', '9007199254740993'],
      duplicateIntentIds: [9007199254740991, '9007199254740992'],
    });
  });

  test.each([0, 9007199254740992, '9223372036854775808', '11'])(
    'blocks a duplicate group with an unusable or repeated ID (%s)',
    id => {
      const report = buildPolicyActiveIntentIntegrityReport({
        activeIntents: [
          { id: 11, policy_id: 10, intent_version: 1, validation_status: 'valid' },
          { id, policy_id: 10, intent_version: 2, validation_status: 'valid' },
        ],
      });

      expect(report.statusId).toBe(POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE);
      expect(report.findings[0]).toMatchObject({
        activeIntentCount: 2,
        canonicalIntentId: null,
        canonicalIntentVersion: null,
        activeIntentIds: [11],
        duplicateIntentIds: [11],
      });
    },
  );

  test('blocks repair when a duplicate group has no validated candidate', () => {
    const report = buildPolicyActiveIntentIntegrityReport({
      activeIntents: [
        { id: 11, policy_id: 10, intent_version: 1, validation_status: 'invalid' },
        { id: 12, policy_id: 10, intent_version: 2, validation_status: 'pending_validation' },
      ],
    });

    expect(report.statusId).toBe(POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE);
    expect(report.findings[0]).toEqual(expect.objectContaining({
      canonicalIntentId: null,
      duplicateIntentIds: [11, 12],
    }));
  });

  test('loads only active duplicate authority metadata from the database', async () => {
    const client = {
      query: jest.fn(async () => ({
        rows: [
          { id: 11, policy_id: 10, intent_version: 1, validation_status: 'valid' },
          { id: 12, policy_id: 10, intent_version: 2, validation_status: 'warning' },
        ],
      })),
    };

    const report = await loadPolicyActiveIntentIntegrityReport(client);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('HAVING COUNT(*) > 1'));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE intent.active = TRUE'));
    expect(report.findings[0].canonicalIntentId).toBe(11);
  });
});
