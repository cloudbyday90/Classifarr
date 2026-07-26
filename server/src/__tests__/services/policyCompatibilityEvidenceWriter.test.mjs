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
  PolicyCompatibilityEvidenceWriter,
} from '../../services/policyCompatibilityEvidenceWriter.mjs';

describe('PolicyCompatibilityEvidenceWriter', () => {
  test('writes a compiled record through a parameterized repository', async () => {
    const record = {
      scope: 'studio',
      mediaType: 'movie',
      libraryId: '8',
      evidenceKey: 'studio:pixar',
      evidenceData: { bucketId: 'compatibility_evidence' },
      confidence: 50,
      provenance: 'policy_confirmed',
      status: 'active',
      createdBy: 'operator-7',
      sourceClassificationId: '42',
      sourceSystem: 'policy_authorized_compatibility',
    };
    const buildRecord = jest.fn().mockReturnValue({ ready: true, record });
    const repository = {
      upsert: jest.fn().mockResolvedValue({
        id: '44',
        scope: 'studio',
        libraryId: '8',
        evidenceKey: 'studio:pixar',
        usageCount: 1,
      }),
    };
    const writer = new PolicyCompatibilityEvidenceWriter({ buildRecord, repository });
    const client = { query: jest.fn() };

    const result = await writer.write({ client, command: { ignored: true } });

    expect(buildRecord).toHaveBeenCalledWith({
      command: { ignored: true },
      executionState: {},
    });
    expect(repository.upsert).toHaveBeenCalledWith({ client, record });
    expect(result).toMatchObject({
      operationId: 'write_compatibility_evidence',
      persisted: true,
      reasonId: 'authorized_outcome_execution_compatibility_evidence_persisted',
      evidence: { id: '44', scope: 'studio', libraryId: '8' },
    });
  });

  test('fails closed without calling persistence when the record is blocked', async () => {
    const repository = { upsert: jest.fn() };
    const writer = new PolicyCompatibilityEvidenceWriter({
      buildRecord: () => ({
        ready: false,
        reasonCodes: ['compatibility_evidence_invalid_authorized_command'],
      }),
      repository,
    });

    await expect(writer.write({ client: { query: jest.fn() } })).rejects.toThrow(
      'compatibility_evidence_invalid_authorized_command',
    );
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});
