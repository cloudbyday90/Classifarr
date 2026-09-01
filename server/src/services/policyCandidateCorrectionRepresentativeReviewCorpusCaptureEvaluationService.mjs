/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration,
} from './policyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration.mjs';
import {
  readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlPersistence.mjs';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationContract.mjs';
import {
  listPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationAggregates,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPersistence.mjs';

export class PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError extends Error {
  constructor(message = 'Future capture evaluation request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CAPTURE_EVALUATION_INVALID_REQUEST';
  }
}

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

/**
 * Reads a current control revision and its active automatic captures in one
 * transaction. It owns no capture write, no individual record read, and no
 * evaluation result persistence, so this report cannot feed back into policy,
 * RAG, AI, learning, retry, or routing behavior.
 */
export function createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService({
  db = defaultDb,
  persistence = {
    readControl: readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    listAggregates: listPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationAggregates,
  },
} = {}) {
  async function getEvaluation({ actorId, now = new Date() } = {}) {
    if (!normalizeActorId(actorId) || typeof db?.withTransaction !== 'function' ||
        typeof persistence?.readControl !== 'function' || typeof persistence?.listAggregates !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError();
    }

    const observedAt = normalizeNow(now);
    try {
      return await db.withTransaction(async client => {
        const controlRow = await persistence.readControl({ dbClient: client });
        const configuration =
          getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration(controlRow);

        const aggregateRows = await persistence.listAggregates({
          dbClient: client,
          configurationRevision: configuration.revision,
          now: observedAt.toISOString(),
        });
        return buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
          configuration,
          aggregateRows,
        });
      });
    } catch (error) {
      if (error instanceof PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError) {
        throw error;
      }
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError(error.message);
    }
  }

  return Object.freeze({ getEvaluation });
}
