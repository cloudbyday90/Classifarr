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
  PolicyIdentityEvidenceAuthorityWriter,
} from '../../services/policyIdentityEvidenceAuthorityWriter.mjs';

describe('PolicyIdentityEvidenceAuthorityWriter', () => {
  test('resolves independent authority before writing an immutable admission', async () => {
    const context = {
      sourceId: 'discord_pending_answer',
      sourceEventId: 'classification:42:discord:992',
      libraryId: '8',
      candidate: { evidenceKey: 'genre:animation', nativeSignalType: 'genres' },
    };
    const record = { sourceId: context.sourceId, sourceEventId: context.sourceEventId };
    const buildContext = jest.fn().mockReturnValue({ ready: true, context });
    const authorityResolver = {
      resolve: jest.fn().mockResolvedValue({ ready: true, statusId: 'verified' }),
    };
    const buildRecord = jest.fn().mockReturnValue({ ready: true, record });
    const repository = {
      upsert: jest.fn().mockResolvedValue({
        replayed: false,
        admission: { id: '61', libraryId: '8', evidenceKey: 'genre:animation' },
      }),
    };
    const writer = new PolicyIdentityEvidenceAuthorityWriter({
      buildContext,
      authorityResolver,
      buildRecord,
      repository,
    });
    const client = { query: jest.fn() };

    const result = await writer.write({ client, command: { input: true }, executionState: { locked: true } });

    expect(authorityResolver.resolve).toHaveBeenCalledWith({
      client,
      libraryId: '8',
      candidate: context.candidate,
      executionState: { locked: true },
    });
    expect(buildRecord).toHaveBeenCalledWith({
      context,
      authorityResult: { ready: true, statusId: 'verified' },
    });
    expect(repository.upsert).toHaveBeenCalledWith({ client, record });
    expect(result).toMatchObject({
      operationId: 'write_identity_evidence',
      persisted: true,
      replayed: false,
      reasonId: 'authorized_outcome_execution_identity_evidence_admission_persisted',
      admission: { id: '61' },
    });
  });

  test('fails before lookup or persistence when command admission is blocked', async () => {
    const authorityResolver = { resolve: jest.fn() };
    const repository = { upsert: jest.fn() };
    const writer = new PolicyIdentityEvidenceAuthorityWriter({
      buildContext: () => ({ ready: false, reasonCodes: ['identity_admission_invalid_operation'] }),
      authorityResolver,
      repository,
    });

    await expect(writer.write({ client: { query: jest.fn() } })).rejects.toThrow(
      'identity_admission_invalid_operation',
    );
    expect(authorityResolver.resolve).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});
