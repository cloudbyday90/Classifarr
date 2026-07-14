import { jest } from '@jest/globals';

import {
  POLICY_LEGACY_WRITE_OPERATION_IDS,
} from '../../services/policyLegacyWriteBoundary.mjs';
import {
  POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED,
  assertLegacyPolicyWriteAllowed,
  lockPolicyAuthorityForLibraryWrite,
  lockPolicyAuthorityForWrite,
} from '../../services/policyLegacyWriteGuard.mjs';

function policy(overrides = {}) {
  return {
    id: 44,
    library_id: 6,
    name: 'Animated Movies Policy',
    native_intent_active: true,
    ...overrides,
  };
}

describe('policyLegacyWriteGuard', () => {
  test('locks policy authority before a mutating route decides whether to write', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [policy()] }),
    };

    const result = await lockPolicyAuthorityForWrite({
      client,
      policyId: 44,
    });

    expect(result).toEqual(policy());
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [44]
    );
    expect(client.query.mock.calls[0][0]).toContain('FROM policy_intents');
  });

  test('can lock a policy authority record by library for automatic writers', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [policy()] }),
    };

    const result = await lockPolicyAuthorityForLibraryWrite({
      client,
      libraryId: 6,
    });

    expect(result).toEqual(policy());
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE lp.library_id = $1'),
      [6]
    );
  });

  test('rejects legacy behavior writes for a policy with active native intent', () => {
    let caught;

    try {
      assertLegacyPolicyWriteAllowed({
        policy: policy(),
        payload: {
          presets: [{ preset_id: 9, weight: 1 }],
          preset_weight: 0.35,
        },
        operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught.statusCode).toBe(409);
    expect(caught.code).toBe(POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED);
    expect(caught.extra).toEqual(expect.objectContaining({
      operation_id: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      blocked_field_groups: expect.arrayContaining([
        'preset_attachments',
        'legacy_scoring_weights',
      ]),
      required_action: 'use_native_intent_command',
    }));
  });

  test('allows metadata-only edits for a policy with active native intent', () => {
    const boundary = assertLegacyPolicyWriteAllowed({
      policy: policy(),
      payload: {
        name: 'Animated Features',
        enabled: true,
      },
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
    });

    expect(boundary.allowed).toBe(true);
    expect(boundary.convertedPolicy).toBe(true);
  });

  test('retains compatibility behavior writes for an unconverted policy', () => {
    const boundary = assertLegacyPolicyWriteAllowed({
      policy: policy({ native_intent_active: false }),
      payload: {
        presets: [{ preset_id: 9, weight: 1 }],
      },
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.ATTACH_PRESET,
    });

    expect(boundary.allowed).toBe(true);
    expect(boundary.convertedPolicy).toBe(false);
  });
});
