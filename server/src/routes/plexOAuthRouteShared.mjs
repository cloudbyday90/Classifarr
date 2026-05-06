/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createPlexOAuthRouter({ express, plexOAuth, db, authenticateToken, logger }) {
  const router = express.Router();

  router.use(authenticateToken);

  router.post('/pin', async (_req, res) => {
    try {
      const pin = await plexOAuth.createPin();
      return res.json(pin);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/pin/:pinId', async (req, res) => {
    try {
      const { pinId } = req.params;
      const status = await plexOAuth.checkPin(pinId);
      return res.json(status);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/servers', async (req, res) => {
    try {
      const { authToken } = req.body;

      if (!authToken) {
        return res.status(400).json({ error: 'authToken is required' });
      }

      const servers = await plexOAuth.getServers(authToken);
      return res.json({ servers });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/user', async (req, res) => {
    try {
      const { authToken } = req.body;

      if (!authToken) {
        return res.status(400).json({ error: 'authToken is required' });
      }

      const user = await plexOAuth.getUser(authToken);
      return res.json({ user });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/test-connection', async (req, res) => {
    try {
      const { url, token } = req.body;

      if (!url || !token) {
        return res.status(400).json({ error: 'url and token are required' });
      }

      const result = await plexOAuth.testServerConnection(url, token);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/find-connection', async (req, res) => {
    try {
      const { server } = req.body;

      if (!server) {
        return res.status(400).json({ error: 'server object is required' });
      }

      const connection = await plexOAuth.findWorkingConnection(server);

      if (connection) {
        return res.json({ success: true, connection });
      }

      return res.json({ success: false, error: 'No working connection found' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/save-server', async (req, res) => {
    const { name, url, token, clientIdentifier } = req.body;

    if (!name || !url || !token) {
      return res.status(400).json({ error: 'name, url, and token are required' });
    }

    try {
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

      return res.json({
        success: true,
        server: result.rows[0],
      });
    } catch (error) {
      logger.error('Failed to save Plex server:', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
