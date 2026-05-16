/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { AppError, ValidationError } from '../../utils/appError.mjs';

function createHttpError(message, httpStatus) {
  if (httpStatus === 400) {
    return new ValidationError(message);
  }

  return new AppError(message, httpStatus);
}

export function maskMediaServerConfig(server, maskTokenValue) {
  if (!server) {
    return null;
  }

  if (!server.api_key) {
    return server;
  }

  return {
    ...server,
    api_key: maskTokenValue(server.api_key),
  };
}

export async function getActiveMediaServerConfig({ db }) {
  const result = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');
  return result.rows[0] || null;
}

export async function saveActiveMediaServerConfig({
  db,
  mediaServerConfig,
  isMaskedTokenValue,
}) {
  const { type, name, url, api_key: apiKey } = mediaServerConfig;

  return db.withTransaction(async (client) => {
    const existingResult = await client.query(
      'SELECT api_key FROM media_server WHERE is_active = true LIMIT 1',
    );
    const existingApiKey = existingResult.rows[0]?.api_key;
    const finalApiKey = (apiKey && !isMaskedTokenValue(apiKey)) ? apiKey : existingApiKey;

    if (!finalApiKey) {
      throw createHttpError('API key is required', 400);
    }

    const activeServerResult = await client.query(
      'SELECT id FROM media_server WHERE is_active = true LIMIT 1',
    );

    if (activeServerResult.rows.length > 0) {
      const result = await client.query(
        `UPDATE media_server
         SET type = $1, name = $2, url = $3, api_key = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [type, name, url, finalApiKey, activeServerResult.rows[0].id],
      );
      return result.rows[0];
    }

    const result = await client.query(
      `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [type, name, url, finalApiKey],
    );
    return result.rows[0];
  });
}

export async function resolveMediaServerApiKey({
  db,
  apiKey,
  isMaskedTokenValue,
}) {
  if (!isMaskedTokenValue(apiKey)) {
    return apiKey;
  }

  const existingServer = await getActiveMediaServerConfig({ db });
  if (!existingServer?.api_key) {
    throw createHttpError('No saved API key found. Please enter the API key manually.', 400);
  }

  return existingServer.api_key;
}

export function resolveMediaServerService({
  type,
  getMediaServerServiceByType,
}) {
  try {
    return getMediaServerServiceByType(type);
  } catch (_error) {
    throw createHttpError('Invalid media server type', 400);
  }
}
