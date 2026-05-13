/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * @typedef {{
 *   primary_provider?: string,
 *   api_endpoint?: string,
 *   api_key?: string,
 * }} AiProviderRequestBody
 */

/**
 * @param {{
 *   body?: AiProviderRequestBody,
 *   dbOrClient: { query?: Function },
 *   resolveRequestApiKey: (options: {
 *     dbOrClient: { query?: Function },
 *     table: string,
 *     submittedApiKey: string | undefined,
 *     allowStoredFallback: boolean,
 *   }) => Promise<string>,
 *   table?: string,
 *   allowStoredFallback?: boolean,
 * }} options
 */
export async function resolveAiProviderRequest({
  body = {},
  dbOrClient,
  resolveRequestApiKey,
  table = 'ai_provider_config',
  allowStoredFallback = true,
}) {
  const {
    primary_provider,
    api_endpoint,
    api_key: submittedApiKey,
  } = body || {};

  const api_key = await resolveRequestApiKey({
    dbOrClient,
    table,
    submittedApiKey,
    allowStoredFallback,
  });

  return {
    primary_provider,
    api_endpoint,
    api_key,
  };
}