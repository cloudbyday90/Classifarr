/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function parseOptionalInteger(value) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createProviderLockHandlers({ providerLock }) {
  return {
    async getHeartbeatConfig(_req, res) {
      try {
        return res.json({
          heartbeat_timeout: providerLock.config.heartbeatTimeout,
          heartbeat_interval: providerLock.config.heartbeatInterval,
          max_wait_time: providerLock.config.maxWaitTime,
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async updateHeartbeatConfig(req, res) {
      try {
        const heartbeatTimeout = parseOptionalInteger(req.body?.heartbeat_timeout);
        const heartbeatInterval = parseOptionalInteger(req.body?.heartbeat_interval);
        const maxWaitTime = parseOptionalInteger(req.body?.max_wait_time);

        if (heartbeatTimeout === null) {
          return res.status(400).json({ error: 'heartbeat_timeout must be an integer' });
        }
        if (heartbeatInterval === null) {
          return res.status(400).json({ error: 'heartbeat_interval must be an integer' });
        }
        if (maxWaitTime === null) {
          return res.status(400).json({ error: 'max_wait_time must be an integer' });
        }

        if (heartbeatTimeout !== undefined && (heartbeatTimeout < 5000 || heartbeatTimeout > 120000)) {
          return res.status(400).json({ error: 'heartbeat_timeout must be between 5000 and 120000 ms' });
        }

        if (heartbeatInterval !== undefined && (heartbeatInterval < 1000 || heartbeatInterval > 30000)) {
          return res.status(400).json({ error: 'heartbeat_interval must be between 1000 and 30000 ms' });
        }

        if (maxWaitTime !== undefined && (maxWaitTime < 10000 || maxWaitTime > 300000)) {
          return res.status(400).json({ error: 'max_wait_time must be between 10000 and 300000 ms' });
        }

        const finalInterval = heartbeatInterval !== undefined ? heartbeatInterval : providerLock.config.heartbeatInterval;
        const finalTimeout = heartbeatTimeout !== undefined ? heartbeatTimeout : providerLock.config.heartbeatTimeout;

        if (finalInterval >= finalTimeout) {
          return res.status(400).json({
            error: 'heartbeat_interval must be less than heartbeat_timeout',
          });
        }

        await providerLock.updateConfig({
          heartbeatTimeout,
          heartbeatInterval,
          maxWaitTime,
        });

        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async getProviderLockStatus(_req, res) {
      try {
        return res.json(providerLock.getLockStatus());
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

