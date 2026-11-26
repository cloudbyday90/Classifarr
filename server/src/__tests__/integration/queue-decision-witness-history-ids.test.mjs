/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { getPool } from './setup.mjs';
import { registerQueueDecisionWitnessRoute } from '../../routes/queueRouteDecisionWitness.mjs';
import { buildClassificationQueueDecisionWitness } from '../../services/classificationQueueDecisionWitness.mjs';
import { ClassificationQueueDecisionWitnessReadService } from '../../services/classificationQueueDecisionWitnessReadService.mjs';
import { ClassificationQueueDecisionWitnessRepository } from '../../services/classificationQueueDecisionWitnessRepository.mjs';

test('returns exact History IDs from PostgreSQL and orders equal-time witnesses by ID', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: [task] } = await client.query(`INSERT INTO task_queue(task_type,payload,priority,source,max_attempts)
      VALUES ('classification','{}',0,'manual',5) RETURNING id`);
    const { rows: [library] } = await client.query(`INSERT INTO libraries(name,external_id,media_type)
      VALUES ('Owned witness library','queue-witness-fixture','movie') RETURNING id,name`);
    const witness = buildClassificationQueueDecisionWitness({
      queueTaskId: task.id,
      result: { method: 'ai_analysis', confidence: 92.5 },
      persistenceState: { status: 'completed', libraryId: library.id, libraryName: library.name },
    });
    const repository = new ClassificationQueueDecisionWitnessRepository({ db: client });
    const app = express();
    registerQueueDecisionWitnessRoute(app, {
      decisionWitnessReadService: new ClassificationQueueDecisionWitnessReadService({ repository }),
    });

    const ids = [44, Number.MAX_SAFE_INTEGER, '9007199254740992', '9007199254740993', '9223372036854775807'];
    for (const [index, id] of ids.entries()) {
      await client.query(`INSERT INTO classification_history
        (id,title,tmdb_id,media_type,status,method,confidence,library_id,library_name)
        VALUES ($1,'Owned witness fixture',$2,'movie','completed','ai_analysis',92.5,$3,$4)`,
      [id, 893100 + index, library.id, library.name]);
      expect(await repository.persist({ classificationId: id, witness })).toEqual({
        persisted: true,
        reason: null,
      });
      const response = await request(app).get(`/tasks/${task.id}/decision-witness`).expect(200);
      expect(response.body).toEqual({
        available: true,
        queueTaskId: task.id,
        classificationId: id,
        decisionWitness: witness,
        history: {
          id, status: 'completed', method: 'ai_analysis', confidence: 92.5,
          libraryId: library.id, libraryName: library.name,
        },
      });
    }
    const { rows: [result] } = await client.query(`SELECT COUNT(DISTINCT created_at)::integer AS timestamps
      FROM classification_queue_decision_witnesses WHERE queue_task_id = $1`, [task.id]);
    expect(result.timestamps).toBe(1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
