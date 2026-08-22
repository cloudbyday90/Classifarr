import { jest } from '@jest/globals';
import {
  buildClassificationQueueDecisionWitness,
  validateClassificationQueueDecisionWitness,
} from '../../services/classificationQueueDecisionWitness.mjs';
import {
  ClassificationQueueDecisionWitnessRepository,
} from '../../services/classificationQueueDecisionWitnessRepository.mjs';
import {
  ClassificationQueueDecisionWitnessReadService,
} from '../../services/classificationQueueDecisionWitnessReadService.mjs';

function buildWitness() {
  return buildClassificationQueueDecisionWitness({
    queueTaskId: 19,
    result: {
      method: 'ai_analysis',
      confidence: 92.5,
      needs_clarification: false,
      needs_retry: false,
      raw_provider_payload: 'never persist this',
    },
    persistenceState: {
      status: 'completed',
      libraryId: 4,
      libraryName: 'Movies',
    },
  });
}

describe('classification queue decision witness contract', () => {
  test('creates a deterministic bounded projection without provider data', () => {
    const witness = buildWitness();

    expect(validateClassificationQueueDecisionWitness(witness)).toEqual({ ok: true });
    expect(witness.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(witness).toEqual(expect.objectContaining({
      queueTaskId: 19,
      outcome: {
        status: 'completed',
        method: 'ai_analysis',
        confidence: 92.5,
        library: { id: 4, name: 'Movies' },
        needsClarification: false,
        needsRetry: false,
      },
    }));
    expect(JSON.stringify(witness)).not.toContain('never persist this');
  });

  test('rejects a tampered result and refuses conflicting final-state flags', () => {
    const witness = buildWitness();
    const tampered = {
      ...witness,
      outcome: { ...witness.outcome, confidence: 7 },
    };

    expect(validateClassificationQueueDecisionWitness(tampered)).toEqual({
      ok: false,
      issue: 'invalid_witness_fingerprint',
    });
    expect(buildClassificationQueueDecisionWitness({
      queueTaskId: 19,
      result: {
        method: 'ai_analysis',
        confidence: 92,
        needs_clarification: true,
        needs_retry: true,
      },
      persistenceState: { status: 'pending_retry' },
    })).toBeNull();
  });
});

describe('classification queue decision witness persistence', () => {
  test('writes only the bounded witness and binds both identifiers', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const repository = new ClassificationQueueDecisionWitnessRepository({ db });
    const witness = buildWitness();

    await expect(repository.persist({ classificationId: 44, witness })).resolves.toEqual({
      persisted: true,
      reason: null,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('classification_queue_decision_witnesses'),
      [19, 44, JSON.stringify(witness), witness.fingerprint],
    );
  });

  test('returns only a validated bounded record to readers', async () => {
    const witness = buildWitness();
    const repository = {
      findLatestByQueueTaskId: jest.fn().mockResolvedValue({
        queue_task_id: 19,
        classification_id: 44,
        witness,
        history_id: 44,
        history_status: 'completed',
        history_method: 'ai_analysis',
        history_confidence: '92.50',
        history_library_id: 4,
        history_library_name: 'Movies',
        raw_payload: 'must not leak',
      }),
    };
    const readService = new ClassificationQueueDecisionWitnessReadService({ repository });

    await expect(readService.read(19)).resolves.toEqual({
      available: true,
      queueTaskId: 19,
      classificationId: 44,
      decisionWitness: witness,
      history: {
        id: 44,
        status: 'completed',
        method: 'ai_analysis',
        confidence: 92.5,
        libraryId: 4,
        libraryName: 'Movies',
      },
    });
  });

  test('withholds records with invalid witness or history bindings', async () => {
    const repository = {
      findLatestByQueueTaskId: jest.fn().mockResolvedValue({
        classification_id: 44,
        witness: { invalid: true },
        history_id: 43,
        history_status: 'completed',
        history_method: 'ai_analysis',
        history_confidence: 92,
        history_library_id: 4,
        history_library_name: 'Movies',
      }),
    };
    const readService = new ClassificationQueueDecisionWitnessReadService({ repository });

    await expect(readService.read(19)).resolves.toEqual({
      available: false,
      reasonId: 'queue_decision_witness_invalid',
    });
  });
});
