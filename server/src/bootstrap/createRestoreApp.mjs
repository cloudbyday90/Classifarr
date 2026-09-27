/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ensureCsrfCookie, csrfProtection } from '../middleware/csrf.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerStaticApplicationDelivery } from './staticApplicationDelivery.mjs';

const AUTH_ROUTES = new Set(['POST /login', 'POST /refresh', 'POST /logout', 'GET /me']);
const BACKUP_ROUTES = new Set(['GET /runtime', 'GET /list', 'POST /preview', 'POST /import']);
const unavailable = (_req, res) => res.status(503).json({
  error: 'Restore maintenance is active. Normal operations require a restart in normal mode.',
  code: 'RESTORE_MAINTENANCE_ACTIVE',
});
const allow = routes => (req, res, next) => routes.has(`${req.method} ${req.path}`) ? next() : unavailable(req, res);

/** No ordinary API router or worker-bearing bootstrap imports in this module. */
export function createRestoreApp({ database, authRouter, backupRouter, publicDir = path.resolve(import.meta.dirname, '../../public') }) {
  const app = express();
  const enforceHttps = process.env.ENFORCE_HTTPS_HEADERS === 'true';
  app.use(helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: enforceHttps ? [] : null } },
    hsts: enforceHttps ? undefined : false,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(ensureCsrfCookie);
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', csrfProtection);
  // A read-only compatibility response keeps the existing authenticated SPA guard.
  app.get('/api/setup/status', (_req, res) => res.json({ setupRequired: false, operatingMode: 'restore' }));
  app.use('/api/auth', allow(AUTH_ROUTES), authRouter);
  app.use('/api/backup', allow(BACKUP_ROUTES), backupRouter);
  app.use('/api', unavailable);
  app.get('/health', async (_req, res) => {
    try {
      await database.query('SELECT 1');
      res.json({ status: 'maintenance', operatingMode: 'restore', workersActive: false });
    } catch {
      res.status(503).json({ status: 'unhealthy', operatingMode: 'restore' });
    }
  });
  app.get('/', (_req, res) => res.redirect('/restore'));
  registerStaticApplicationDelivery({ app, publicDir });
  app.use(errorHandler);
  return app;
}
