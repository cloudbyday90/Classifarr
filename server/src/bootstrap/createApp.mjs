/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUiDefault from 'swagger-ui-express';
import { router as apiRouterDefault } from '../routes/api.mjs';
import { router as authRouterDefault } from '../routes/auth.mjs';
import { router as setupRouterDefault } from '../routes/setup.mjs';
import { router as systemRouterDefault } from '../routes/system.mjs';
import { router as userRouterDefault } from '../routes/user.mjs';
import { errorHandler as errorHandlerDefault } from '../middleware/errorHandler.mjs';
import {
  ensureCsrfCookie as ensureCsrfCookieDefault,
  csrfProtection as csrfProtectionDefault,
} from '../middleware/csrf.mjs';
import { generateSpec as generateSwaggerSpecDefault } from '../utils/swaggerSpec.mjs';
import { evaluateCorsOrigin as evaluateCorsOriginDefault } from '../utils/corsPolicy.mjs';
const publicDir = path.resolve(import.meta.dirname, '../../public');

function buildCorsOptions(runtimeSettings, evaluateCorsOrigin) {
  return {
    origin: (origin, callback) => {
      const allowedOrigins = runtimeSettings.getCorsOriginsList();
      const decision = evaluateCorsOrigin(origin, allowedOrigins);

      if (decision.reject) {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, decision.value);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Key', 'X-CSRF-Token'],
  };
}

function buildCspDirectives(enforceHttpsHeaders) {
  const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: enforceHttpsHeaders ? [] : null,
  };

  if (process.env.NODE_ENV !== 'production') {
    cspDirectives.connectSrc.push('http://localhost:*', 'ws://localhost:*');
  }

  return cspDirectives;
}

function buildSwaggerSpec(generateSwaggerSpec, port) {
  return generateSwaggerSpec({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Classifarr API',
        version: '1.0.0',
        description: 'AI-powered media classification for the *arr ecosystem',
      },
      servers: [
        {
          url: `http://localhost:${port}`,
        },
      ],
    },
    apis: ['./src/routes/*.{js,mjs}'],
  });
}

function registerHealthRoute(app, database) {
  app.get('/health', async (_req, res) => {
    try {
      await database.query('SELECT 1');
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export function createApp({
  database,
  runtimeSettings,
  port,
  apiRouter = apiRouterDefault,
  authRouter = authRouterDefault,
  setupRouter = setupRouterDefault,
  systemRouter = systemRouterDefault,
  userRouter = userRouterDefault,
  swaggerUi = swaggerUiDefault,
  errorHandler = errorHandlerDefault,
  ensureCsrfCookie = ensureCsrfCookieDefault,
  csrfProtection = csrfProtectionDefault,
  generateSwaggerSpec = generateSwaggerSpecDefault,
  evaluateCorsOrigin = evaluateCorsOriginDefault,
}) {
  const app = express();
  const swaggerSpec = buildSwaggerSpec(generateSwaggerSpec, port);
  const securityHeadersStrict = (process.env.SECURITY_HEADERS_STRICT || 'true').toLowerCase() !== 'false';
  const enforceHttpsHeaders = (process.env.ENFORCE_HTTPS_HEADERS || 'false').toLowerCase() === 'true';

  app.use(helmet({
    contentSecurityPolicy: {
      directives: buildCspDirectives(enforceHttpsHeaders),
    },
    hsts: enforceHttpsHeaders ? undefined : false,
    crossOriginOpenerPolicy: securityHeadersStrict ? undefined : false,
    originAgentCluster: securityHeadersStrict,
  }));
  app.use(cors(buildCorsOptions(runtimeSettings, evaluateCorsOrigin)));
  app.use(morgan('combined'));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(ensureCsrfCookie);
  app.use('/api', csrfProtection);

  app.use('/api/setup', setupRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/system', systemRouter);
  app.use('/api', apiRouter);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  registerHealthRoute(app, database);

  app.use(express.static(publicDir));
  app.get('{*splat}', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  app.use(errorHandler);

  return app;
}
