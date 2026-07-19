import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyOperatorWorkflowReadRoutes,
} from '../routes/policiesRouteOperatorWorkflowRead.mjs';

function createApp({ rows = [], mappingRows = [], workflowResult = {} } = {}) {
  const getWorkflow = jest.fn().mockResolvedValue(workflowResult);
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: mappingRows }),
  };
  const app = express();
  const router = express.Router();

  registerPolicyOperatorWorkflowReadRoutes(router, {
    db,
    operatorWorkflowReadService: { getWorkflow },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, db, getWorkflow };
}

describe('policy operator workflow read routes', () => {
  test('reads the library, mapping, and bounded workflow display projection', async () => {
    const workflowResult = { statusId: 'ready', rawPayloadExposed: false };
    const { app, db, getWorkflow } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
      mappingRows: [{
        arr_type: 'radarr',
        arr_config_id: 4,
        arr_root_folder_path: '/movies/animated',
      }],
      workflowResult,
    });

    const response = await request(app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(200);

    expect(response.body).toEqual(workflowResult);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(getWorkflow).toHaveBeenCalledWith({
      library: { id: 6, name: 'Animated Movies', media_type: 'movie' },
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'radarr library mapping',
      },
    });
  });

  test('keeps unmapped libraries read-only and reports invalid or missing libraries safely', async () => {
    const { app, getWorkflow } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
      mappingRows: [],
      workflowResult: { statusId: 'profile_unavailable' },
    });

    await request(app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(200);
    expect(getWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      routing: {
        configured: false,
        routeReady: false,
        targetName: null,
      },
    }));

    const invalid = createApp();
    await request(invalid.app)
      .get('/api/policies/operator-workflow/libraries/not-a-number')
      .expect(400);
    expect(invalid.db.query).not.toHaveBeenCalled();

    const missing = createApp({ rows: [] });
    await request(missing.app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(404);
    expect(missing.getWorkflow).not.toHaveBeenCalled();
  });
});
