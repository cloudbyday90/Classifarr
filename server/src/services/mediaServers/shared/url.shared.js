/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function normalizeBaseUrl(baseUrl) {
  return typeof baseUrl === 'string' ? baseUrl.replace(/\/+$/, '') : '';
}

function normalizeResourcePath(path) {
  if (!path) {
    return null;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function buildPathUrl(baseUrl, path) {
  const normalizedPath = normalizeResourcePath(path);
  if (!normalizedPath) {
    return null;
  }

  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

function appendQueryParam(url, key, value) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

const urlHelpers = {
  normalizeBaseUrl,
  normalizeResourcePath,
  buildPathUrl,
  appendQueryParam,
};

module.exports = urlHelpers;
module.exports.normalizeBaseUrl = normalizeBaseUrl;
module.exports.normalizeResourcePath = normalizeResourcePath;
module.exports.buildPathUrl = buildPathUrl;
module.exports.appendQueryParam = appendQueryParam;
module.exports.default = urlHelpers;
