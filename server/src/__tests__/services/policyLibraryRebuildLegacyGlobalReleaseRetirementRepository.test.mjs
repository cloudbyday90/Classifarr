/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  loadPolicyLibraryRebuildLegacyEnabledPolicyInventory,
} from '../../services/policyLibraryRebuildLegacyGlobalReleaseRetirementRepository.mjs';

describe('policyLibraryRebuildLegacyGlobalReleaseRetirementRepository', () => {
  test('loads enabled policies in deterministic shared-lock order', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ policy_id: 44, library_id: 6 }],
      }),
    };

    await expect(loadPolicyLibraryRebuildLegacyEnabledPolicyInventory({ client })).resolves.toEqual([
      { policy_id: 44, library_id: 6 },
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE enabled = TRUE'));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY id ASC'));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'));
  });

  test('requires a transaction client', async () => {
    await expect(loadPolicyLibraryRebuildLegacyEnabledPolicyInventory()).rejects.toThrow(
      'requires a transaction client',
    );
  });
});
