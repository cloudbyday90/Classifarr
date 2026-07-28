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

const purgeAllLegacyPatterns = jest.fn();
const purgeAll = jest.fn();

jest.unstable_mockModule('../../services/classificationEvidenceService.mjs', () => ({
  classificationEvidenceService: { purgeAllLegacyPatterns },
}));
jest.unstable_mockModule('../../services/classificationEvidenceRepository.mjs', () => ({
  classificationEvidenceRepository: { purgeAll },
}));

const { clearExistingConfig } = await import('../../services/backupRestore.mjs');

describe('backup restore authorized outcome receipt lifecycle', () => {
  beforeEach(() => {
    purgeAllLegacyPatterns.mockReset();
    purgeAll.mockReset();
  });

  test('clears runtime refresh work, recovery circuits, identity admissions, and source-event receipts during replace restore', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await clearExistingConfig(client);

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM policy_profile_refresh_outbox'
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM policy_native_profile_refresh_circuits'
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT set_config('classifarr.policy_identity_evidence_admission_maintenance', 'replace_restore', true)"
    );
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      'DELETE FROM policy_identity_evidence_admissions'
    );
    expect(client.query).toHaveBeenNthCalledWith(
      5,
      "SELECT set_config('classifarr.policy_authorized_outcome_receipt_maintenance', 'replace_restore', true)"
    );
    expect(client.query).toHaveBeenNthCalledWith(
      6,
      'DELETE FROM policy_authorized_outcome_source_event_receipts'
    );
  });
});
