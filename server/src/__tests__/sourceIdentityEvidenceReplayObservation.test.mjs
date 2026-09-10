/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import {
  SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
  toSourceIdentityEvidenceReplayObservation,
} from '../services/sourceIdentityEvidenceReplayObservationContract.mjs';
import {
  deleteExpiredSourceIdentityEvidenceReplayObservations,
  upsertSourceIdentityEvidenceReplayObservation,
} from '../services/sourceIdentityEvidenceReplayObservationRepository.mjs';
import {
  createSourceIdentityEvidenceReplayObservationService,
  sourceIdentityEvidenceReplayObservationService,
} from '../services/sourceIdentityEvidenceReplayObservationService.mjs';

function replayReceipt({ status = 'complete', summary } = {}) {
  return {
    version: 'source_identity_external_evidence_replay.v1',
    status: { id: status },
    summary: summary ?? (status === 'failed' ? null : {
      selectedObservationCount: 1,
      maximumObservations: 32,
      maximumObservationsPerLibrary: 8,
      libraryLimit: 12,
      librarySelection: 'daily_rotating_library_id_window',
      activeLibraryCount: 2,
      selectedLibraryCount: 1,
      excludedLibraryCount: 1,
      outcomes: { exact_candidate_agreement: 1 },
      resolutionReasons: { external_id_match: 1 },
    }),
  };
}

describe('source identity evidence replay observation contract', () => {
  test('projects a fixed aggregate receipt and excludes unknown source data', () => {
    const observation = toSourceIdentityEvidenceReplayObservation(replayReceipt());

    expect(observation).toEqual({
      version: SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
      status: { id: 'complete' },
      summary: expect.objectContaining({ outcomes: { exact_candidate_agreement: 1 } }),
    });
    expect(JSON.stringify(observation)).not.toContain('source-item');
  });

  test('rejects raw fields, unsupported codes, and inconsistent counts', () => {
    const withRawField = replayReceipt();
    withRawField.summary.sourceItemId = 'source-item';
    expect(() => toSourceIdentityEvidenceReplayObservation(withRawField)).toThrow('unrecognised summary fields');

    const unsupportedCode = replayReceipt();
    unsupportedCode.summary.outcomes = { source_item: 1 };
    expect(() => toSourceIdentityEvidenceReplayObservation(unsupportedCode)).toThrow('unsupported aggregate code');

    const inconsistent = replayReceipt();
    inconsistent.summary.outcomes = {};
    expect(() => toSourceIdentityEvidenceReplayObservation(inconsistent)).toThrow('totals are inconsistent');

    expect(() => toSourceIdentityEvidenceReplayObservation(replayReceipt({
      status: 'no_current_conflicts',
    }))).toThrow('status is inconsistent');
  });

  test('records a failed replay only as its fixed failed status', () => {
    expect(toSourceIdentityEvidenceReplayObservation(replayReceipt({ status: 'failed' }))).toEqual({
      version: SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
      status: { id: 'failed' },
      summary: null,
    });
  });
});

describe('source identity evidence replay observation persistence', () => {
  test('uses parameterized upsert and date-bounded retention statements', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    const observation = toSourceIdentityEvidenceReplayObservation(replayReceipt());

    await upsertSourceIdentityEvidenceReplayObservation({
      query,
      observedOn: '2026-09-10',
      observedAt: '2026-09-10T03:25:00.000Z',
      observation,
    });
    await deleteExpiredSourceIdentityEvidenceReplayObservations({
      query,
      cutoffOn: '2026-05-13',
    });

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('ON CONFLICT'), [
      '2026-09-10',
      '2026-09-10T03:25:00.000Z',
      SOURCE_IDENTITY_EVIDENCE_REPLAY_OBSERVATION_VERSION,
      'complete',
      JSON.stringify(observation),
    ]);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE observed_on < $1::date'), ['2026-05-13']);
  });
});

describe('source identity evidence replay observation service', () => {
  test('exposes a lazy default facade so module loading never starts observation work', () => {
    expect(Object.isFrozen(sourceIdentityEvidenceReplayObservationService)).toBe(true);
    expect(typeof sourceIdentityEvidenceReplayObservationService.observe).toBe('function');
    expect(typeof sourceIdentityEvidenceReplayObservationService.prune).toBe('function');
  });

  test('reads first, completes external replay after the transaction, and persists only the projected aggregate', async () => {
    const stages = [];
    const query = jest.fn();
    const client = {
      query: jest.fn(async (statement) => {
        stages.push(statement.startsWith('SET TRANSACTION') ? 'snapshot' : 'selection');
        return { rows: [{ source: 'not-retained' }] };
      }),
    };
    const withTransaction = jest.fn(async (callback) => {
      stages.push('transaction-start');
      const result = await callback(client);
      stages.push('transaction-end');
      return result;
    });
    const createReplay = jest.fn(({ readRows }) => ({
      replay: async () => {
        await readRows();
        stages.push('external-evidence');
        return replayReceipt();
      },
    }));
    const upsert = jest.fn().mockResolvedValue();
    const service = createSourceIdentityEvidenceReplayObservationService({
      query,
      withTransaction,
      createReplay,
      upsert,
      now: () => new Date('2026-09-10T03:25:00.000Z'),
    });

    await expect(service.observe()).resolves.toMatchObject({ status: { id: 'complete' } });

    expect(stages).toEqual([
      'transaction-start',
      'snapshot',
      'selection',
      'transaction-end',
      'external-evidence',
    ]);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      observedOn: '2026-09-10',
      observation: expect.objectContaining({ status: { id: 'complete' } }),
    }));
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toContain('not-retained');
  });

  test('prunes on a fixed UTC retention boundary', async () => {
    const removeExpired = jest.fn().mockResolvedValue();
    const service = createSourceIdentityEvidenceReplayObservationService({
      createReader: () => ({ read: jest.fn() }),
      createReplay: () => ({ replay: jest.fn() }),
      removeExpired,
      now: () => new Date('2026-09-10T23:59:59.000Z'),
    });

    await service.prune();

    expect(removeExpired).toHaveBeenCalledWith(expect.objectContaining({ cutoffOn: '2026-05-13' }));
  });
});
