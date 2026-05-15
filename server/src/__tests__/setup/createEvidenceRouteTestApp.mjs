import express from 'express';

import { createEvidenceRouter } from '../../routes/evidenceRouteShared.mjs';
import { errorHandler } from '../../middleware/errorHandler.mjs';

export function createEvidenceRouteTestApp({
  classificationEvidenceRepository,
  evidenceDiagnosticsService,
  logger,
  user = null,
}) {
  const app = express();
  app.use(express.json());

  if (user) {
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
  }

  app.use('/evidence', createEvidenceRouter({
    express,
    classificationEvidenceRepository,
    evidenceDiagnosticsService,
    logger,
  }));

  app.use(errorHandler);

  return app;
}