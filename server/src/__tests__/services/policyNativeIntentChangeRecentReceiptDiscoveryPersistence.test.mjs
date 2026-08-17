/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  loadPolicyNativeIntentChangeRecentReceiptDiscoveryContext,
} from '../../services/policyNativeIntentChangeRecentReceiptDiscoveryPersistence.mjs';

describe('policyNativeIntentChangeRecentReceiptDiscoveryPersistence', () => {
  test('scopes a newest-one receipt query to actor, policy, and the fixed server window', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          result_status_id: 'applied',
          source_intent_version: 3,
          target_intent_version: 4,
        }],
      }),
    };

    const result = await loadPolicyNativeIntentChangeRecentReceiptDiscoveryContext({
      client,
      actorId: 7,
      policyId: 17,
      maxAgeSeconds: 3600,
    });

    const [statement, parameters] = client.query.mock.calls[0];
    const projection = statement.slice(statement.indexOf('SELECT'), statement.indexOf('FROM'));
    expect(parameters).toEqual([7, 17, 3600]);
    expect(statement).toContain('actor_id = $1');
    expect(statement).toContain('policy_id = $2');
    expect(statement).toContain("created_at >= NOW() - ($3::integer * INTERVAL '1 second')");
    expect(statement).toContain('ORDER BY created_at DESC, id DESC');
    expect(projection).not.toMatch(
      /idempotency_key|command_fingerprint|applied_command_ids|migration_event_id|target_intent_id|created_at/i,
    );
    expect(result).toEqual({
      result_status_id: 'applied',
      source_intent_version: 3,
      target_intent_version: 4,
    });
  });
});
