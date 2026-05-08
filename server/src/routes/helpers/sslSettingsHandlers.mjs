/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import crypto from 'node:crypto';
import { access, open } from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';

export const DEFAULT_SSL_CONFIG = {
  enabled: false,
  cert_path: '',
  key_path: '',
  ca_path: '',
  force_https: false,
  hsts_enabled: false,
  hsts_max_age: 31536000,
  client_cert_required: false,
};

export async function fetchSslConfig(dbOrClient) {
  const result = await dbOrClient.query('SELECT * FROM ssl_config LIMIT 1');
  return result.rows[0] || null;
}

function parseHstsMaxAge(value, fallback = DEFAULT_SSL_CONFIG.hsts_max_age) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function resolveNullablePath(body, existing, key) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return existing?.[key] ?? null;
  }

  return body[key] || null;
}

export function normalizeSslConfig(body = {}, existing = null) {
  const prior = existing || DEFAULT_SSL_CONFIG;

  return {
    enabled: body.enabled ?? prior.enabled ?? DEFAULT_SSL_CONFIG.enabled,
    cert_path: resolveNullablePath(body, existing, 'cert_path'),
    key_path: resolveNullablePath(body, existing, 'key_path'),
    ca_path: resolveNullablePath(body, existing, 'ca_path'),
    force_https: body.force_https ?? prior.force_https ?? DEFAULT_SSL_CONFIG.force_https,
    hsts_enabled: body.hsts_enabled ?? prior.hsts_enabled ?? DEFAULT_SSL_CONFIG.hsts_enabled,
    hsts_max_age: parseHstsMaxAge(body.hsts_max_age, prior.hsts_max_age ?? DEFAULT_SSL_CONFIG.hsts_max_age),
    client_cert_required: body.client_cert_required ?? prior.client_cert_required ?? DEFAULT_SSL_CONFIG.client_cert_required,
  };
}

export function presentSslConfig(config) {
  if (!config) {
    return { ...DEFAULT_SSL_CONFIG };
  }

  return {
    ...DEFAULT_SSL_CONFIG,
    ...config,
    cert_path: config.cert_path || '',
    key_path: config.key_path || '',
    ca_path: config.ca_path || '',
  };
}

async function readValidatedUtf8File(filePath) {
  const normalizedPath = path.resolve(String(filePath || ''));
  if (!normalizedPath) {
    throw new Error('File path is required');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is validated and normalized from trusted config, not user input
  const handle = await open(normalizedPath, 'r');
  try {
    return await handle.readFile({ encoding: 'utf8' });
  } finally {
    await handle.close();
  }
}

export function createSslSettingsHandlers({
  db,
  accessFile = access,
  readUtf8File = readValidatedUtf8File,
  createSecureContext = tls.createSecureContext,
  createX509Certificate = (certData) => new crypto.X509Certificate(certData),
  getNow = () => new Date(),
}) {
  return {
    async getConfig(_req, res) {
      try {
        const config = await fetchSslConfig(db);
        res.json(presentSslConfig(config));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      try {
        const existing = await fetchSslConfig(db);
        const payload = normalizeSslConfig(req.body, existing);

        const result = await db.query(
          `INSERT INTO ssl_config (
            id, enabled, cert_path, key_path, ca_path,
            force_https, hsts_enabled, hsts_max_age, client_cert_required
          )
           VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE
           SET enabled = $1,
               cert_path = $2,
               key_path = $3,
               ca_path = $4,
               force_https = $5,
               hsts_enabled = $6,
               hsts_max_age = $7,
               client_cert_required = $8,
               updated_at = NOW()
           RETURNING *`,
          [
            payload.enabled,
            payload.cert_path,
            payload.key_path,
            payload.ca_path,
            payload.force_https,
            payload.hsts_enabled,
            payload.hsts_max_age,
            payload.client_cert_required,
          ]
        );

        res.json({
          ...presentSslConfig(result.rows[0]),
          requiresRestart: true,
          message: 'SSL configuration saved. Please restart Classifarr for changes to take effect.',
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async testCertificates(req, res) {
      try {
        const { cert_path, key_path, ca_path } = req.body;
        const results = {
          cert_exists: false,
          key_exists: false,
          ca_exists: true,
          valid: false,
        };

        if (cert_path) {
          try {
            await accessFile(cert_path);
            results.cert_exists = true;
          } catch (_error) {
            return res.json({ ...results, error: 'Certificate file not found' });
          }
        } else {
          return res.json({ ...results, error: 'Certificate path is required' });
        }

        if (key_path) {
          try {
            await accessFile(key_path);
            results.key_exists = true;
          } catch (_error) {
            return res.json({ ...results, error: 'Private key file not found' });
          }
        } else {
          return res.json({ ...results, error: 'Private key path is required' });
        }

        if (ca_path) {
          try {
            await accessFile(ca_path);
            results.ca_exists = true;
          } catch (_error) {
            results.ca_exists = false;
            return res.json({ ...results, error: 'CA certificate file not found' });
          }
        }

        try {
          const certData = await readUtf8File(cert_path);
          const keyData = await readUtf8File(key_path);

          createSecureContext({
            cert: certData,
            key: keyData,
          });

          const cert = createX509Certificate(certData);
          const now = getNow();
          const validFrom = new Date(cert.validFrom);
          const validTo = new Date(cert.validTo);

          if (now < validFrom) {
            return res.json({ ...results, error: 'Certificate is not yet valid' });
          }

          if (now > validTo) {
            return res.json({ ...results, error: 'Certificate has expired' });
          }

          const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

          results.valid = true;
          results.subject = cert.subject;
          results.issuer = cert.issuer;
          results.validFrom = cert.validFrom;
          results.validTo = cert.validTo;
          results.daysUntilExpiry = daysUntilExpiry;

          let message = 'SSL certificates are valid';
          if (daysUntilExpiry < 30) {
            message += ` (expires in ${daysUntilExpiry} days - renewal recommended)`;
          }

          res.json({ ...results, message });
        } catch (error) {
          res.json({ ...results, error: 'Invalid certificate or key: ' + error.message });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  };
}

