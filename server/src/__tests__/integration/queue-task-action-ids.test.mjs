/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/classification.mjs', () => ({ classificationService: {} }));

const { createQueueRouter } = await import('../../routes/queueRouteShared.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { QueueMutationService } = await import('../../services/queueMutationService.mjs');
const { QueueAdminService } = await import('../../services/queueAdminService.mjs');
const { QueueReadModel } = await import('../../services/queueReadModel.mjs');
const db = await import('../../config/database.mjs');

const ADJACENT_ID = '9007199254740992';
const SELECTED_ID = '9007199254740993';
const MAX_ID = '9223372036854775807';
const TASK_IDS = [ADJACENT_ID, SELECTED_ID, MAX_ID];
const LIBRARY_NAME = 'Exact queue action fixture';
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function fixture(permissions = 'read_write') {
  const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true, arrType: 'radarr', reason: 'routed' });
  const mutations = new QueueMutationService({ db, logger });
  const admin = new QueueAdminService({ db, logger, classificationService: { routeToArr } });
  const readModel = new QueueReadModel({ db, logger });
  const app = express();
  app.use(express.json());
  app.use(createQueueRouter({ express, logger, requireReadWrite,
    authenticateTokenOrApiKey: (req, _res, next) => { req.apiKey = { permissions }; next(); },
    queueService: {
      retryTask: mutations.retryTask.bind(mutations),
      dismissFailedTask: mutations.dismissFailedTask.bind(mutations),
      cancelTask: mutations.cancelTask.bind(mutations),
      manualClassifyTask: admin.manualClassifyTask.bind(admin),
      getPendingTasks: readModel.getPendingTasks.bind(readModel),
      getFailedTasks: readModel.getFailedTasks.bind(readModel),
    },
  }));
  app.use(errorHandler);
  return { app, mutations, admin, routeToArr };
}

async function addTasks(status) {
  const completedAt = status === 'failed' ? new Date() : null;
  for (const [index, id] of TASK_IDS.entries()) {
    await getPool().query(`INSERT INTO task_queue(id,task_type,status,payload,completed_at)
      VALUES ($1,'classification',$2,$3,$4)`,
    [id, status, { title: `Queue action ${id}`, tmdb_id: 895500 + index, media_type: 'movie' }, completedAt]);
  }
}

async function taskStatus(id) {
  const { rows: [task] } = await getPool().query('SELECT status FROM task_queue WHERE id=$1', [id]);
  return task?.status ?? null;
}

afterEach(async () => {
  await getPool().query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [TASK_IDS]);
  await getPool().query('DELETE FROM classification_history WHERE library_name=$1', [LIBRARY_NAME]);
  await getPool().query('DELETE FROM libraries WHERE name=$1', [LIBRARY_NAME]);
});

test.each([
  ['retry', 'failed', 'pending'],
  ['dismiss', 'failed', null],
  ['cancel', 'pending', 'cancelled'],
])('%s acts on the exact task from the queue list', async (action, initialStatus, finalStatus) => {
  await addTasks(initialStatus);
  const { app } = fixture();
  const list = await request(app).get(`/${initialStatus}`).expect(200);
  expect(list.body.map(task => task.id)).toEqual(expect.arrayContaining(TASK_IDS));

  for (const id of [SELECTED_ID, MAX_ID]) {
    await request(app).post(`/task/${id}/${action}`).expect(200, { success: true });
    expect(await taskStatus(id)).toBe(finalStatus);
    expect(await taskStatus(ADJACENT_ID)).toBe(initialStatus);
  }
});

test('manual classification selects the exact task and a duplicate cannot repeat routing', async () => {
  await addTasks('pending');
  const { rows: [library] } = await getPool().query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES($1,'exact-queue-action','movie') RETURNING id`, [LIBRARY_NAME]);
  const { app, routeToArr } = fixture();
  const body = { library_id: library.id };

  for (const id of [SELECTED_ID, MAX_ID]) {
    const selection = await request(app).post(`/tasks/${id}/classify`).send(body).expect(200);
    expect(selection.body).toMatchObject({ success: true, libraryId: library.id, routing: { routed: true, recorded: true } });
    expect(routeToArr).toHaveBeenLastCalledWith(expect.objectContaining({ title: `Queue action ${id}` }),
      expect.objectContaining({ id: library.id }), expect.any(Object));
    expect(await taskStatus(id)).toBe('completed');
    expect(await taskStatus(ADJACENT_ID)).toBe('pending');
    await request(app).post(`/tasks/${id}/classify`).send(body).expect(409);
  }
  expect(routeToArr).toHaveBeenCalledTimes(2);
});

test('refuses invalid selectors and read-only principals before mutating a queue row', async () => {
  await addTasks('pending');
  const { app, mutations, admin, routeToArr } = fixture();
  for (const id of [`${SELECTED_ID}suffix`, '9223372036854775808']) {
    for (const path of [`/task/${id}/retry`, `/task/${id}/dismiss`, `/task/${id}/cancel`, `/tasks/${id}/classify`]) {
      await request(app).post(path).send({ library_id: 1 }).expect(400,
        { error: 'Valid task id is required', code: 'invalid_task_id' });
    }
  }
  const unsafeNumber = Number(ADJACENT_ID);
  const invalidTask = { code: 'invalid_task_id', statusCode: 400 };
  await expect(mutations.retryTask(unsafeNumber)).rejects.toMatchObject(invalidTask);
  await expect(mutations.dismissFailedTask(unsafeNumber)).rejects.toMatchObject(invalidTask);
  await expect(mutations.cancelTask(unsafeNumber)).rejects.toMatchObject(invalidTask);
  await expect(admin.manualClassifyTask(unsafeNumber, 1)).rejects.toMatchObject(invalidTask);

  const readOnlyApp = fixture('read_only').app;
  await request(readOnlyApp).post(`/task/${SELECTED_ID}/cancel`).expect(403);
  expect(await Promise.all(TASK_IDS.map(taskStatus))).toEqual(['pending', 'pending', 'pending']);
  expect(routeToArr).not.toHaveBeenCalled();
});
