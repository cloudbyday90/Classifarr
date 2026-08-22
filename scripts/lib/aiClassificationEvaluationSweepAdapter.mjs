/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  evaluateAiClassificationEvaluation,
} from '../../server/src/services/aiClassificationEvaluationGrader.mjs';
import {
  AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION,
  validateAiClassificationEvaluationFixture,
} from '../../server/src/services/aiClassificationEvaluationFixtureContract.mjs';
import {
  buildAiClassificationEvaluationFingerprintSet,
} from '../../server/src/services/aiClassificationEvaluationFingerprint.mjs';
import {
  validateClassificationQueueDecisionWitness,
} from '../../server/src/services/classificationQueueDecisionWitness.mjs';

const AI_CLASSIFICATION_EVALUATION_STATUS = Object.freeze({
  EVALUATED: 'evaluated',
  INVALID: 'invalid',
  NOT_EVALUATED: 'not_evaluated',
  NOT_REQUESTED: 'not_requested',
});

function asPositiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function asFiniteNumber(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function projectLibrary(value, { idKey = 'id', nameKey = 'name' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const id = asPositiveInteger(value[idKey]);
  const name = typeof value[nameKey] === 'string' ? value[nameKey] : null;
  if (id === null && name === null) {
    return null;
  }

  return {
    ...(id === null ? {} : { id }),
    ...(name === null ? {} : { name }),
  };
}

function projectLiveObservation({ classificationResponse, historyRow } = {}) {
  return {
    classification: {
      method: classificationResponse?.method ?? null,
      confidence: asFiniteNumber(classificationResponse?.confidence),
      library: projectLibrary(classificationResponse?.library),
      needsClarification: classificationResponse?.needs_clarification,
      needsRetry: classificationResponse?.needs_retry,
    },
    history: {
      method: historyRow?.method ?? null,
      status: historyRow?.status ?? null,
      confidence: asFiniteNumber(historyRow?.confidence),
      library: projectLibrary(historyRow, {
        idKey: 'library_id',
        nameKey: 'library_name',
      }),
    },
  };
}

function projectQueuedDecisionWitnessObservation({ decisionWitness, historyRow } = {}) {
  return {
    classification: {
      method: decisionWitness?.outcome?.method ?? null,
      confidence: asFiniteNumber(decisionWitness?.outcome?.confidence),
      library: projectLibrary(decisionWitness?.outcome?.library),
      needsClarification: decisionWitness?.outcome?.needsClarification,
      needsRetry: decisionWitness?.outcome?.needsRetry,
    },
    history: {
      method: historyRow?.method ?? null,
      status: historyRow?.status ?? null,
      confidence: asFiniteNumber(historyRow?.confidence),
      library: projectLibrary(historyRow, {
        idKey: 'library_id',
        nameKey: 'library_name',
      }),
    },
  };
}

function toSweepFixture(fixture) {
  if (fixture?.version === AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION) {
    return {
      ...fixture.request,
      name: fixture.name,
      tmdb_id: fixture.request.tmdbId,
      media_type: fixture.request.mediaType,
      evaluationFixture: fixture,
    };
  }

  return {
    ...fixture,
    evaluationFixture: null,
  };
}

function normalizeSweepFixtures(fixtures) {
  return Array.isArray(fixtures) ? fixtures.map(toSweepFixture) : [];
}

function buildSweepEvaluationArtifact({
  fixture,
  classificationResponse,
  queueDecisionWitness,
  historyRow,
  policyContext,
  runtime,
} = {}) {
  const evaluationFixture = fixture?.evaluationFixture ?? null;
  if (!evaluationFixture) {
    return {
      status: AI_CLASSIFICATION_EVALUATION_STATUS.NOT_REQUESTED,
      reasonId: 'legacy_fixture_without_expected_outcome',
    };
  }

  const fixtureValidation = validateAiClassificationEvaluationFixture(evaluationFixture);
  if (!fixtureValidation.ok) {
    return {
      status: AI_CLASSIFICATION_EVALUATION_STATUS.INVALID,
      fixtureId: typeof evaluationFixture.id === 'string' ? evaluationFixture.id : null,
      reasonId: 'invalid_evaluation_fixture',
    };
  }

  let observation;
  let evaluationSource;
  if (classificationResponse) {
    observation = projectLiveObservation({ classificationResponse, historyRow });
    evaluationSource = 'direct_response';
  } else if (queueDecisionWitness) {
    const witnessValidation = validateClassificationQueueDecisionWitness(queueDecisionWitness);
    if (!witnessValidation.ok) {
      return {
        status: AI_CLASSIFICATION_EVALUATION_STATUS.NOT_EVALUATED,
        fixtureId: evaluationFixture.id,
        reasonId: 'queue_decision_witness_invalid',
      };
    }
    observation = projectQueuedDecisionWitnessObservation({
      decisionWitness: queueDecisionWitness,
      historyRow,
    });
    evaluationSource = 'queued_decision_witness';
  } else {
    return {
      status: AI_CLASSIFICATION_EVALUATION_STATUS.NOT_EVALUATED,
      fixtureId: evaluationFixture.id,
      reasonId: 'classification_response_not_observable',
    };
  }

  if (!historyRow) {
    return {
      status: AI_CLASSIFICATION_EVALUATION_STATUS.NOT_EVALUATED,
      fixtureId: evaluationFixture.id,
      reasonId: 'persisted_history_not_observable',
    };
  }

  const result = evaluateAiClassificationEvaluation({
    fixture: evaluationFixture,
    observation,
  });

  return {
    status: AI_CLASSIFICATION_EVALUATION_STATUS.EVALUATED,
    fixtureId: evaluationFixture.id,
    evaluationSource,
    result,
    fingerprints: buildAiClassificationEvaluationFingerprintSet({
      fixture: evaluationFixture,
      policyContext,
      runtime: {
        ...runtime,
        queueDecisionWitness: queueDecisionWitness
          ? {
            version: queueDecisionWitness.version,
            algorithm: queueDecisionWitness.algorithm,
            fingerprint: queueDecisionWitness.fingerprint,
          }
          : null,
      },
      evaluation: result,
    }),
  };
}

export {
  AI_CLASSIFICATION_EVALUATION_STATUS,
  buildSweepEvaluationArtifact,
  normalizeSweepFixtures,
  projectQueuedDecisionWitnessObservation,
  projectLiveObservation,
};
