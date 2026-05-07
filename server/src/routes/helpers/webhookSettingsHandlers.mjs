/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';
const WEBHOOK_MASK_CHAR = '•';

function isMaskedWebhookSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  return isMaskedToken(secret) || secret.includes(WEBHOOK_MASK_CHAR);
}

function maskWebhookSecret(config, fullSecret = null) {
  if (!config) {
    return null;
  }

  const masked = { ...config };
  if (fullSecret) {
    masked.secret_key = maskToken(fullSecret);
  } else if (masked.secret_key) {
    masked.secret_key = maskToken(masked.secret_key);
  }
  return masked;
}

function parseWebhookConfigId(rawId) {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildWebhookUrl(req, secretKey) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let url = `${baseUrl}/api/webhook/overseerr`;
  if (secretKey) {
    url += `?key=${encodeURIComponent(secretKey)}`;
  }
  return url;
}

export function createWebhookSettingsHandlers({ webhookService, httpClient }) {
  return {
    async getConfig(_req, res) {
      try {
        const config = await webhookService.getConfig();
        const fullSecret = await webhookService.getFullSecret();
        res.json(maskWebhookSecret(config, fullSecret));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      try {
        const config = { ...req.body };

        if (config.secret_key && isMaskedWebhookSecret(config.secret_key)) {
          const fullSecret = await webhookService.getFullSecret();
          if (fullSecret) {
            config.secret_key = fullSecret;
          } else {
            delete config.secret_key;
          }
        }

        const result = await webhookService.updateConfig(config);
        const fullSecret = await webhookService.getFullSecret();
        res.json(maskWebhookSecret(result, fullSecret));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async generateKey(_req, res) {
      try {
        const secretKey = webhookService.generateSecretKey();
        const config = await webhookService.updateConfig({ secret_key: secretKey });
        res.json({
          ...config,
          secret_key: secretKey,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getSecret(_req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();

        if (!secretKey) {
          return res.status(404).json({ error: 'No webhook secret configured' });
        }

        res.json({ secret_key: secretKey });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getUrl(req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();
        res.json({ url: buildWebhookUrl(req, secretKey) });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getLogs(req, res) {
      try {
        const { page = 1, limit = 50, status, media_type } = req.query;
        const result = await webhookService.getLogs({
          page: Number.parseInt(page, 10),
          limit: Number.parseInt(limit, 10),
          status,
          media_type,
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getStats(_req, res) {
      try {
        const stats = await webhookService.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async sendTestWebhook(req, res) {
      try {
        const secretKey = await webhookService.getFullSecret();
        const url = buildWebhookUrl(req, secretKey);

        const testPayload = {
          notification_type: 'TEST_NOTIFICATION',
          event: 'test',
          subject: 'Test Notification from Classifarr',
          message: 'This is a test webhook to verify your configuration',
          media: {
            media_type: 'movie',
            tmdbId: 550,
            title: 'Test Movie',
            releaseDate: '1999-10-15',
          },
        };

        const response = await httpClient.post(url, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Classifarr-Test',
          },
        });

        res.json({
          success: true,
          message: 'Test webhook sent successfully',
          response: response.data,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          details: error.response?.data,
        });
      }
    },

    async listConfigs(_req, res) {
      try {
        const configs = await webhookService.getAllConfigs();
        res.json(configs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getConfigById(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        const config = await webhookService.getConfigById(id);
        if (!config) {
          return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(maskWebhookSecret(config));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async createConfig(req, res) {
      try {
        if (!req.body.name) {
          return res.status(400).json({ error: 'Name is required' });
        }

        const payload = { ...req.body };
        if (payload.secret_key && isMaskedWebhookSecret(payload.secret_key)) {
          delete payload.secret_key;
        }

        const config = await webhookService.createConfig(payload);
        res.status(201).json(config);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async updateConfigById(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        const payload = { ...req.body };
        if (payload.secret_key && isMaskedWebhookSecret(payload.secret_key)) {
          delete payload.secret_key;
        }

        const config = await webhookService.updateConfigById(id, payload);
        if (!config) {
          return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(maskWebhookSecret(config));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async deleteConfig(req, res) {
      try {
        const id = parseWebhookConfigId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid configuration id' });
        }

        await webhookService.deleteConfig(id);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    },
  };
}

