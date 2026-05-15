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
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

export function createEmbyAuthRouter({
  express,
  embyAuth,
  db,
  authenticateToken,
}) {
  const router = express.Router();

  router.use(authenticateToken);

  router.post('/test', asyncHandler(async (req, res) => {
    const { serverUrl } = req.body;

    if (!serverUrl) {
      return sendError(res, 'serverUrl is required');
    }

    const result = await embyAuth.testConnection(serverUrl);
    return sendData(res, result);
  }));

  router.post('/authenticate', asyncHandler(async (req, res) => {
    const { serverUrl, username, password } = req.body;

    if (!serverUrl || !username) {
      return sendError(res, 'serverUrl and username are required');
    }

    const result = await embyAuth.authenticateWithPassword(serverUrl, username, password || '');
    return sendData(res, result);
  }));

  router.post('/verify', asyncHandler(async (req, res) => {
    const { serverUrl, token } = req.body;

    if (!serverUrl || !token) {
      return sendError(res, 'serverUrl and token are required');
    }

    const result = await embyAuth.verifyToken(serverUrl, token);
    return sendData(res, result);
  }));

  router.post('/save', asyncHandler(async (req, res) => {
    const { serverUrl, token, serverName } = req.body;

    if (!serverUrl || !token) {
      return sendError(res, 'serverUrl and token are required');
    }

    let name = serverName;
    if (!name) {
      const info = await embyAuth.getServerInfo(serverUrl, token);
      name = info.success ? info.serverName : 'Emby Server';
    }

    const result = await db.withTransaction(async (client) => {
      await client.query('UPDATE media_server SET is_active = false');
      return client.query(
        `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, type, name, url, is_active, created_at`,
        ['emby', name, serverUrl, token],
      );
    });

    return sendSuccess(res, { server: result.rows[0] });
  }));

  return router;
}
