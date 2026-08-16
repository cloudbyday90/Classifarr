/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyNativeIntentChangeCommandFingerprint,
  buildPolicyNativeIntentChangeReceiptRecord,
  receiptMatchesNativeIntentChange,
} from '../../services/policyNativeIntentChangeReceiptContract.mjs';

const COMMANDS = [{
  commandId: 'update_purpose',
  values: [{
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation', 'Comedy'] },
  }],
}];

describe('policyNativeIntentChangeReceiptContract', () => {
  test('uses a stable canonical fingerprint and binds it to actor, policy, and source revision', () => {
    const fingerprint = buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      changeCommands: COMMANDS,
    });
    const reordered = buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      changeCommands: [{
        commandId: 'update_purpose',
        values: [{ values: { require_any: ['Animation', 'Comedy'] }, operator: 'require_any', signal_type: 'genres' }],
      }],
    });

    expect(reordered).toBe(fingerprint);
    expect(buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 2,
      expectedRevision: 3,
      changeCommands: COMMANDS,
    })).not.toBe(fingerprint);
  });

  test('creates a bounded receipt record that matches only the original command binding', () => {
    const commandFingerprint = buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      changeCommands: COMMANDS,
    });
    const receipt = buildPolicyNativeIntentChangeReceiptRecord({
      policyId: 42,
      actorId: 1,
      idempotencyKey: 'a'.repeat(32),
      commandFingerprint,
      sourceIntentVersion: 3,
      targetIntentId: 100,
      targetIntentVersion: 4,
      migrationEventId: 200,
      appliedCommandIds: ['update_purpose'],
    });

    expect(receipt).toEqual(expect.objectContaining({
      policyId: 42,
      actorId: 1,
      appliedCommandIds: ['update_purpose'],
      resultStatusId: 'applied',
    }));
    expect(receiptMatchesNativeIntentChange({
      receipt,
      policyId: 42,
      actorId: 1,
      commandFingerprint,
    })).toBe(true);
    expect(receiptMatchesNativeIntentChange({
      receipt,
      policyId: 42,
      actorId: 2,
      commandFingerprint,
    })).toBe(false);
  });
});
