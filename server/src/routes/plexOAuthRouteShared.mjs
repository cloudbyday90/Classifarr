/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';

export function createPlexOAuthRouter({ express, plexOAuth, db, authenticateToken }) {
  const router = express.Router();

  router.use(authenticateToken);

  router.post('/pin', asyncHandler(async (_req, res) => {
    const pin = await plexOAuth.createPin();
    return sendData(res, pin);
  }));

  router.get('/pin/:pinId', asyncHandler(async (req, res) => {
    const { pinId } = req.params;
    const status = await plexOAuth.checkPin(pinId);
    return sendData(res, status);
  }));

  router.post('/servers', asyncHandler(async (req, res) => {
    const { authToken } = req.body;

    if (!authToken) {
      throw new ValidationError('authToken is required');
    }

    const servers = await plexOAuth.getServers(authToken);
    return sendData(res, { servers });
  }));

  router.post('/user', asyncHandler(async (req, res) => {
    const { authToken } = req.body;

    if (!authToken) {
      throw new ValidationError('authToken is required');
    }

    const user = await plexOAuth.getUser(authToken);
    return sendData(res, { user });
  }));

  router.post('/test-connection', asyncHandler(async (req, res) => {
    const { url, token } = req.body;

    if (!url || !token) {
      throw new ValidationError('url and token are required');
    }

    const result = await plexOAuth.testServerConnection(url, token);
    return sendData(res, result);
  }));

  router.post('/find-connection', asyncHandler(async (req, res) => {
    const { server } = req.body;

    if (!server) {
      throw new ValidationError('server object is required');
    }

    const connection = await plexOAuth.findWorkingConnection(server);

    if (connection) {
      return sendSuccess(res, { connection });
    }

    return sendData(res, { success: false, error: 'No working connection found' });
  }));

  router.post('/save-server', asyncHandler(async (req, res) => {
    const { name, url, token, clientIdentifier } = req.body;

    if (!name || !url || !token) {
      throw new ValidationError('name, url, and token are required');
    }

    const result = await db.withTransaction(async (client) => {
      await client.query('UPDATE media_server SET is_active = false WHERE type = $1', ['plex']);

      if (clientIdentifier) {
        return client.query(
          `INSERT INTO media_server (type, name, url, api_key, client_identifier, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (client_identifier) WHERE client_identifier IS NOT NULL DO UPDATE
           SET name = EXCLUDED.name,
               url = EXCLUDED.url,
               api_key = EXCLUDED.api_key,
               is_active = true,
               updated_at = NOW()
           RETURNING id, type, name, url, is_active, created_at, updated_at`,
          ['plex', name, url, token, clientIdentifier],
        );
      }

      return client.query(
        `INSERT INTO media_server (type, name, url, api_key, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (type, url) WHERE client_identifier IS NULL DO UPDATE
           SET name = EXCLUDED.name,
               api_key = EXCLUDED.api_key,
               is_active = true,
               updated_at = NOW()
           RETURNING id, type, name, url, is_active, created_at, updated_at`,
        ['plex', name, url, token],
      );
    });

    return sendSuccess(res, { server: result.rows[0] });
  }));

  return router;
}
