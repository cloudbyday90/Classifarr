/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { createLogger } = require('../utils/logger');
const {
  encryptValue,
  decryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
  generateRandomKey,
  maskKey,
  constantTimeCompare,
} = require('../utils/encryption');

const logger = createLogger('WebhookService');

const SECRET_PREFIX = 'whsec_';
const SECRET_BYTE_LENGTH = 32;

function isEncrypted(value) {
  return value && value.includes('$') && value.split('$').length === 3;
}

function maskConfig(config) {
  if (!config) {
    return config;
  }

  if (config.secret_key) {
    if (isEncrypted(config.secret_key)) {
      config.secret_key = maskKey(SECRET_PREFIX, 6) + '••••••••';
    } else if (config.secret_key.startsWith(SECRET_PREFIX)) {
      config.secret_key = maskKey(config.secret_key, 12);
    } else {
      config.secret_key = maskKey(SECRET_PREFIX, 6) + '••••••••';
    }
  }

  return config;
}

function maskConfigs(configs) {
  if (!configs || !Array.isArray(configs)) {
    return configs;
  }

  return configs.map((config) => maskConfig(config));
}

function encryptSecret(secret) {
  const { encrypted, iv, authTag } = encryptValue(secret);
  return formatEncryptedValue(encrypted, iv, authTag);
}

function decryptSecret(encryptedSecret) {
  const { encrypted, iv, authTag } = parseEncryptedValue(encryptedSecret);
  return decryptValue(encrypted, iv, authTag);
}

function generateSecretKey() {
  return generateRandomKey(SECRET_PREFIX, SECRET_BYTE_LENGTH);
}

function normalizeSecretKeyInput(secretKey) {
  if (secretKey === undefined) {
    return null;
  }

  if (secretKey === '') {
    return '';
  }

  if (secretKey && secretKey.startsWith(SECRET_PREFIX)) {
    return encryptSecret(secretKey);
  }

  return secretKey || null;
}

function validateAuth(providedKey, config) {
  if (!providedKey) {
    return false;
  }
  if (Array.isArray(providedKey)) {
    return false;
  }
  if (typeof providedKey !== 'string') {
    return false;
  }

  let storedSecret = config.secret_key;
  if (!storedSecret) {
    return false;
  }

  if (isEncrypted(storedSecret)) {
    try {
      storedSecret = decryptSecret(storedSecret);
    } catch (error) {
      logger.warn(
        'Failed to decrypt webhook secret for validation',
        { error: error.message },
        { skipDbPersist: true },
      );
      return false;
    }
  }

  const key = providedKey.startsWith('Bearer ')
    ? providedKey.slice(7)
    : providedKey;

  return constantTimeCompare(key, storedSecret);
}

function sanitizePayload(body, options = {}) {
  const { includeSpecials = false } = options;
  if (!body || typeof body !== 'object') {
    return { payload: {}, specialsExcluded: 0 };
  }

  if (includeSpecials) {
    return { payload: body, specialsExcluded: 0 };
  }

  let payload;
  try {
    payload = JSON.parse(JSON.stringify(body));
  } catch (_error) {
    payload = { ...body };
  }

  if (!payload || typeof payload !== 'object') {
    payload = {};
  }

  let specialsExcluded = 0;

  if (payload.request && Array.isArray(payload.request.seasons)) {
    const originalCount = payload.request.seasons.length;
    payload.request.seasons = payload.request.seasons.filter((season) => {
      const rawSeason = (season && typeof season === 'object')
        ? (season.seasonNumber ?? season.season_number ?? season.season ?? season.number ?? season.index)
        : season;
      const seasonNumber = typeof rawSeason === 'string' ? parseInt(rawSeason, 10) : rawSeason;
      return seasonNumber !== 0;
    });
    specialsExcluded += originalCount - payload.request.seasons.length;
  }

  if (Array.isArray(payload.extra)) {
    const originalCount = payload.extra.length;
    payload.extra = payload.extra.filter((entry) => {
      if (!entry || typeof entry !== 'object') {
        return true;
      }
      const seasonValue = entry.seasonNumber ?? entry.season_number ?? entry.season ?? entry.seasonIndex ?? entry.season_index;
      if (seasonValue === undefined || seasonValue === null) {
        return true;
      }
      const seasonNumber = typeof seasonValue === 'string' ? parseInt(seasonValue, 10) : seasonValue;
      return seasonNumber !== 0;
    });
    specialsExcluded += originalCount - payload.extra.length;
  }

  return { payload, specialsExcluded };
}

function parsePayload(body) {
  const normalizedBody = body && typeof body === 'object' ? body : {};
  logger.debug('Parsing webhook payload', { body: normalizedBody });

  const notification_type = normalizedBody.notification_type || normalizedBody.event;
  const subject = normalizedBody.subject || '';
  const media = normalizedBody.media || {};
  const request = normalizedBody.request || {};
  const requestedBy = request.requestedBy || normalizedBody.requestedBy || {};

  let media_type = media.media_type || media.mediaType;
  if (!media_type) {
    media_type = subject.includes('Movie') ? 'movie' : 'tv';
  }

  const parsed = {
    notification_type,
    event_name: normalizedBody.event || notification_type,
    media_type,
    tmdb_id: media.tmdbId || media.tmdb_id,
    tvdb_id: media.tvdbId || media.tvdb_id,
    request_id: request.request_id || request.id || normalizedBody.request_id,
    title: subject || media.title || media.name,
    year: media.releaseDate ? new Date(media.releaseDate).getFullYear() : null,
    poster_path: media.posterPath || media.poster_path || normalizedBody.image,
    is_4k: request.is4k || normalizedBody.is_4k || false,
    requested_by_username: request.requestedBy_username || requestedBy.username || requestedBy.displayName,
    requested_by_email: request.requestedBy_email || requestedBy.email,
    requested_by_avatar: request.requestedBy_avatar || requestedBy.avatar,
    requested_seasons: request.seasons ? JSON.stringify(request.seasons) : null,
    requested_at: request.createdAt || normalizedBody.createdAt,
    media_status: media.status,
    media_status_4k: media.status4k,
  };

  logger.debug('Parsed webhook payload', { parsed });
  return parsed;
}

module.exports = {
  SECRET_PREFIX,
  SECRET_BYTE_LENGTH,
  _isEncrypted: isEncrypted,
  _maskConfig: maskConfig,
  _maskConfigs: maskConfigs,
  _encryptSecret: encryptSecret,
  _decryptSecret: decryptSecret,
  normalizeSecretKeyInput,
  generateSecretKey,
  validateAuth,
  sanitizePayload,
  parsePayload,
};
