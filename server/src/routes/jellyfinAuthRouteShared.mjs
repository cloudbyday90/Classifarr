/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createJellyfinAuthRouter({
  express,
  jellyfinAuth,
  db,
  authenticateToken,
  logger,
}) {
  const router = express.Router();

  router.use(authenticateToken);

  router.post('/test', async (req, res) => {
    try {
      const { serverUrl } = req.body;

      if (!serverUrl) {
        return res.status(400).json({ error: 'serverUrl is required' });
      }

      const result = await jellyfinAuth.testConnection(serverUrl);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/quick-connect/enabled', async (req, res) => {
    try {
      const { serverUrl } = req.body;

      if (!serverUrl) {
        return res.status(400).json({ error: 'serverUrl is required' });
      }

      const enabled = await jellyfinAuth.isQuickConnectEnabled(serverUrl);
      return res.json({ enabled });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/quick-connect/initiate', async (req, res) => {
    try {
      const { serverUrl } = req.body;

      if (!serverUrl) {
        return res.status(400).json({ error: 'serverUrl is required' });
      }

      const result = await jellyfinAuth.initiateQuickConnect(serverUrl);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/quick-connect/check', async (req, res) => {
    try {
      const { serverUrl, secret } = req.body;

      if (!serverUrl || !secret) {
        return res.status(400).json({ error: 'serverUrl and secret are required' });
      }

      const result = await jellyfinAuth.checkQuickConnect(serverUrl, secret);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/quick-connect/authenticate', async (req, res) => {
    try {
      const { serverUrl, secret } = req.body;

      if (!serverUrl || !secret) {
        return res.status(400).json({ error: 'serverUrl and secret are required' });
      }

      const result = await jellyfinAuth.authenticateWithQuickConnect(serverUrl, secret);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/authenticate', async (req, res) => {
    try {
      const { serverUrl, username, password } = req.body;

      if (!serverUrl || !username) {
        return res.status(400).json({ error: 'serverUrl and username are required' });
      }

      const result = await jellyfinAuth.authenticateWithPassword(serverUrl, username, password || '');
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/save', async (req, res) => {
    const client = await db.pool.connect();
    try {
      const { serverUrl, token, serverName } = req.body;

      if (!serverUrl || !token) {
        return res.status(400).json({ error: 'serverUrl and token are required' });
      }

      let name = serverName;
      if (!name) {
        const info = await jellyfinAuth.getServerInfo(serverUrl, token);
        name = info.success ? info.serverName : 'Jellyfin Server';
      }

      await client.query('BEGIN');
      await client.query('UPDATE media_server SET is_active = false');

      const result = await client.query(
        `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, type, name, url, is_active, created_at`,
        ['jellyfin', name, serverUrl, token],
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        server: result.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save Jellyfin server:', { error: error.message });
      return res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
}