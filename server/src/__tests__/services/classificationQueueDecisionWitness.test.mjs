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

function buildWitness(queueTaskId = 19) {
  return buildClassificationQueueDecisionWitness({
    queueTaskId,
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
    expect(witness.version).toBe('classifarr.classification_queue_decision_witness.v1');
    expect(witness.fingerprint).toBe('77c1adc285558ccb3330a7065c2f7bd53b3af8a2f439c32cffa01ec8adc9d2e4');
    expect(buildWitness('19')).toEqual(witness);
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

  test.each(['9007199254740992', '9007199254740993', '9223372036854775807'])(
    'uses the exact large ID %s in v2', queueTaskId => {
      const witness = buildWitness(queueTaskId);
      expect(witness).toMatchObject({ queueTaskId, version: 'classifarr.classification_queue_decision_witness.v2' });
      expect(validateClassificationQueueDecisionWitness(witness, { queueTaskId })).toEqual({ ok: true });
      expect(validateClassificationQueueDecisionWitness({ ...witness, version: buildWitness().version }).ok).toBe(false);
      expect(validateClassificationQueueDecisionWitness({ ...witness, queueTaskId: Number(queueTaskId) }).ok).toBe(false);
    },
  );

  test('keeps safe IDs in v1 and rejects ambiguous task IDs or wire versions', () => {
    const witness = buildWitness();
    expect(buildWitness(String(Number.MAX_SAFE_INTEGER))).toMatchObject({
      queueTaskId: Number.MAX_SAFE_INTEGER, version: witness.version,
    });
    for (const value of ['019', '+19', '19.0', '19suffix', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1]) {
      expect(buildWitness(value)).toBeNull();
    }
    expect(validateClassificationQueueDecisionWitness({ ...witness, queueTaskId: '19' }).ok).toBe(false);
    expect(validateClassificationQueueDecisionWitness({
      ...witness, queueTaskId: '19', version: 'classifarr.classification_queue_decision_witness.v2',
    }).ok).toBe(false);
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
      [19, '44', JSON.stringify(witness), witness.fingerprint],
    );
  });

  test('binds an exact large classification ID and rejects unsafe or noncanonical input', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const repository = new ClassificationQueueDecisionWitnessRepository({ db });
    const witness = buildWitness();

    await expect(repository.persist({ classificationId: '9007199254740993', witness }))
      .resolves.toEqual({ persisted: true, reason: null });
    expect(db.query).toHaveBeenCalledWith(expect.any(String),
      [19, '9007199254740993', JSON.stringify(witness), witness.fingerprint]);
    for (const classificationId of [Number.MAX_SAFE_INTEGER + 1, '044', '+44', '9223372036854775808']) {
      await expect(repository.persist({ classificationId, witness }))
        .resolves.toEqual({ persisted: false, reason: 'invalid_witness' });
    }
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('returns only a validated bounded record to readers', async () => {
    const witness = buildWitness();
    const repository = {
      findLatestByQueueTaskId: jest.fn().mockResolvedValue({
        queue_task_id: 19,
        classification_id: 44,
        witness,
        fingerprint: witness.fingerprint,
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

  test.each([
    { queue_task_id: '9007199254740992' },
    { fingerprint: 'a'.repeat(64) },
    { witness: buildWitness('9007199254740992') },
  ])('requires the stored task and fingerprint to agree with the validated witness', overrides => {
    const queueTaskId = '9007199254740993';
    const witness = buildWitness(queueTaskId);
    const readService = new ClassificationQueueDecisionWitnessReadService({
      repository: {
        findLatestByQueueTaskId: jest.fn().mockResolvedValue({
          queue_task_id: queueTaskId,
          classification_id: 44,
          witness,
          fingerprint: witness?.fingerprint,
          history_id: 44,
          history_status: 'completed',
          history_method: 'ai_analysis',
          history_confidence: 92.5,
          history_library_id: 4,
          history_library_name: 'Movies',
          ...overrides,
        }),
      },
    });
    return expect(readService.read(queueTaskId)).resolves.toEqual({
      available: false, reasonId: 'queue_decision_witness_invalid',
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

  test.each([
    ['9007199254740992', '9007199254740993'],
    ['044', 44],
    [44, '4.4e1'],
    [9007199254740992, '9007199254740992'],
    ['9223372036854775808', '9223372036854775808'],
  ])('withholds invalid or mismatched History IDs %p and %p', async (classificationId, historyId) => {
    const witness = buildWitness();
    const readService = new ClassificationQueueDecisionWitnessReadService({
      repository: {
        findLatestByQueueTaskId: jest.fn().mockResolvedValue({
          queue_task_id: 19,
          classification_id: classificationId,
          witness,
          fingerprint: witness.fingerprint,
          history_id: historyId,
          history_status: 'completed',
          history_method: 'ai_analysis',
          history_confidence: 92.5,
          history_library_id: 4,
          history_library_name: 'Movies',
        }),
      },
    });

    await expect(readService.read(19)).resolves.toEqual({
      available: false,
      reasonId: 'queue_decision_witness_invalid',
    });
  });
});
