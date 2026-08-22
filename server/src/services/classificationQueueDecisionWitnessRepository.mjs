/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as database from '../config/database.mjs';
import { validateClassificationQueueDecisionWitness } from './classificationQueueDecisionWitness.mjs';

function asPositiveInteger(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

export class ClassificationQueueDecisionWitnessRepository {
  constructor({ db = database } = {}) {
    this.db = db;
  }

  async persist({ classificationId, witness } = {}) {
    const normalizedClassificationId = asPositiveInteger(classificationId);
    const witnessValidation = validateClassificationQueueDecisionWitness(witness);
    if (normalizedClassificationId === null || !witnessValidation.ok) {
      return { persisted: false, reason: 'invalid_witness' };
    }

    const result = await this.db.query(
      `INSERT INTO classification_queue_decision_witnesses
         (queue_task_id, classification_id, witness, fingerprint)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (queue_task_id, classification_id) DO NOTHING`,
      [
        witness.queueTaskId,
        normalizedClassificationId,
        JSON.stringify(witness),
        witness.fingerprint,
      ],
    );

    return { persisted: result.rowCount === 1, reason: result.rowCount === 1 ? null : 'already_exists' };
  }

  async findLatestByQueueTaskId(queueTaskId) {
    const normalizedQueueTaskId = asPositiveInteger(queueTaskId);
    if (normalizedQueueTaskId === null) {
      return null;
    }

    const result = await this.db.query(
      `SELECT
         witness.queue_task_id,
         witness.classification_id,
         witness.witness,
         witness.fingerprint,
         witness.created_at,
         history.id AS history_id,
         history.status AS history_status,
         history.method AS history_method,
         history.confidence AS history_confidence,
         history.library_id AS history_library_id,
         history.library_name AS history_library_name
       FROM classification_queue_decision_witnesses AS witness
       INNER JOIN classification_history AS history
         ON history.id = witness.classification_id
       WHERE witness.queue_task_id = $1
       ORDER BY witness.created_at DESC, witness.classification_id DESC
       LIMIT 1`,
      [normalizedQueueTaskId],
    );

    return result.rows[0] || null;
  }
}

export const classificationQueueDecisionWitnessRepository =
  new ClassificationQueueDecisionWitnessRepository();
