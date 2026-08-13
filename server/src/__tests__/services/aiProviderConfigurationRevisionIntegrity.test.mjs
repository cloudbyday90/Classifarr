/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  acquireAiProviderConfigurationRevisionWriteLock,
  AI_PROVIDER_CONFIGURATION_REVISION_LOCK_NAME,
  normalizePositiveAiProviderConfigurationRevision,
} from '../../services/aiProviderConfigurationRevisionIntegrity.mjs';

describe('AI provider configuration revision integrity', () => {
  test('preserves positive PostgreSQL BIGINT revisions as exact decimal strings', () => {
    expect(normalizePositiveAiProviderConfigurationRevision('9007199254740992'))
      .toBe('9007199254740992');
    expect(normalizePositiveAiProviderConfigurationRevision(42)).toBe('42');
    expect(normalizePositiveAiProviderConfigurationRevision(42n)).toBe('42');
  });

  test.each([
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '0',
    '-1',
    '1.5',
    '9223372036854775808',
  ])('rejects an invalid revision value: %p', (value) => {
    expect(() => normalizePositiveAiProviderConfigurationRevision(value))
      .toThrow('configuration revision is invalid');
  });

  test('acquires a transaction-scoped advisory lock before a singleton configuration write', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireAiProviderConfigurationRevisionWriteLock(client);

    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [AI_PROVIDER_CONFIGURATION_REVISION_LOCK_NAME],
    );
  });

  test('rejects a missing database client', async () => {
    await expect(acquireAiProviderConfigurationRevisionWriteLock(null))
      .rejects.toThrow('revision lock requires a database query client');
  });
});
