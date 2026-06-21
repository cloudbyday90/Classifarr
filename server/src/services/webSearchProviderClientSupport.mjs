/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ServiceUnavailableError } from '../utils/appError.mjs';

export function getWebSearchProviderConfig(options = {}) {
  return options.config && typeof options.config === 'object'
    ? options.config
    : {};
}

export function getWebSearchProviderOption(options, key, fallback) {
  const providerConfig = getWebSearchProviderConfig(options);
  return options?.[key] ?? providerConfig[key] ?? fallback;
}

export function requireWebSearchProviderApiKey(apiKey, providerName) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new ServiceUnavailableError(`${providerName} API key is required`);
  }
  return String(apiKey).trim();
}

export function extractWebSearchProviderErrorMessage(error, fallback = 'Provider request failed') {
  const data = error?.response?.data ?? error?.cause?.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object') {
    const message = data.error?.message
      || data.error
      || data.message
      || data.error_description;
    if (message) return String(message);
  }
  return error?.cause?.message || error?.message || fallback;
}

export function preserveWebSearchProviderError(error, prefix) {
  const thrownError = new Error(`${prefix}: ${extractWebSearchProviderErrorMessage(error)}`);
  thrownError.status = error?.response?.status ?? error?.status ?? null;
  thrownError.statusCode = thrownError.status;
  thrownError.response = error?.response ?? null;
  thrownError.code = error?.code ?? null;
  thrownError.cause = error;
  return thrownError;
}

export async function testWebSearchProviderConnection(search, providerName) {
  try {
    await search();
    return { success: true, message: 'Connection successful' };
  } catch (error) {
    return {
      success: false,
      error: extractWebSearchProviderErrorMessage(error, `${providerName} connection failed`),
    };
  }
}
