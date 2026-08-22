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
  validateClassificationQueueDecisionWitness,
} from './classificationQueueDecisionWitness.mjs';
import {
  classificationQueueDecisionWitnessRepository,
} from './classificationQueueDecisionWitnessRepository.mjs';

function asPositiveInteger(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function asConfidence(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
}

function asIdentifier(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : null;
}

function asLibraryName(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    !/[\u0000-\u001F\u007F]/.test(value) ? value : null;
}

function buildHistoryProjection(row) {
  const id = asPositiveInteger(row?.history_id);
  const status = asIdentifier(row?.history_status);
  const method = asIdentifier(row?.history_method);
  const confidence = row?.history_confidence === null ? null : asConfidence(row?.history_confidence);
  const libraryId = row?.history_library_id === null ? null : asPositiveInteger(row?.history_library_id);
  const libraryName = row?.history_library_name === null ? null : asLibraryName(row?.history_library_name);

  if (!id || !status || !method ||
      (confidence === null && row?.history_confidence !== null) ||
      (libraryId === null) !== (libraryName === null)) {
    return null;
  }

  return { id, status, method, confidence, libraryId, libraryName };
}

export class ClassificationQueueDecisionWitnessReadService {
  constructor({ repository = classificationQueueDecisionWitnessRepository } = {}) {
    this.repository = repository;
  }

  async read(queueTaskId) {
    const normalizedQueueTaskId = asPositiveInteger(queueTaskId);
    if (normalizedQueueTaskId === null) {
      return { available: false, reasonId: 'invalid_queue_task_id' };
    }

    const row = await this.repository.findLatestByQueueTaskId(normalizedQueueTaskId);
    if (!row) {
      return { available: false, reasonId: 'queue_decision_witness_not_available' };
    }

    const witnessValidation = validateClassificationQueueDecisionWitness(row.witness, {
      queueTaskId: normalizedQueueTaskId,
    });
    const classificationId = asPositiveInteger(row.classification_id);
    const history = buildHistoryProjection(row);
    if (!witnessValidation.ok || !classificationId || !history || history.id !== classificationId) {
      return { available: false, reasonId: 'queue_decision_witness_invalid' };
    }

    return {
      available: true,
      queueTaskId: normalizedQueueTaskId,
      classificationId,
      decisionWitness: row.witness,
      history,
    };
  }
}

export const classificationQueueDecisionWitnessReadService =
  new ClassificationQueueDecisionWitnessReadService();
