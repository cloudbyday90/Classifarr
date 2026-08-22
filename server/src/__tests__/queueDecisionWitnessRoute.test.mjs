import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createQueueRouter } from '../routes/queueRouteShared.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';

function createApp(decisionWitnessReadService) {
  const app = express();
  app.use('/api/queue', createQueueRouter({
    express,
    queueService: {},
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    authenticateTokenOrApiKey: (_req, _res, next) => next(),
    requireReadWrite: (_req, _res, next) => next(),
    decisionWitnessReadService,
  }));
  app.use(errorHandler);
  return app;
}

describe('queue decision witness route', () => {
  test('returns the bounded witness and no queue payload', async () => {
    const decisionWitnessReadService = {
      read: jest.fn().mockResolvedValue({
        available: true,
        queueTaskId: 19,
        classificationId: 44,
        decisionWitness: { version: 'classifarr.classification_queue_decision_witness.v1' },
        history: { id: 44, status: 'completed', method: 'ai_analysis' },
      }),
    };

    const response = await request(createApp(decisionWitnessReadService))
      .get('/api/queue/tasks/19/decision-witness')
      .expect(200);

    expect(decisionWitnessReadService.read).toHaveBeenCalledWith(19);
    expect(response.body).not.toHaveProperty('payload');
    expect(response.body.history).toEqual(expect.objectContaining({ id: 44 }));
  });

  test('rejects a non-positive queue task id before reaching the reader', async () => {
    const decisionWitnessReadService = { read: jest.fn() };

    await request(createApp(decisionWitnessReadService))
      .get('/api/queue/tasks/0/decision-witness')
      .expect(400);

    expect(decisionWitnessReadService.read).not.toHaveBeenCalled();
  });
});
