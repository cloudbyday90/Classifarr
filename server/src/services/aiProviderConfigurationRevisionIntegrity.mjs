/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const AI_PROVIDER_CONFIGURATION_REVISION_LOCK_NAME =
  'classifarr.ai_provider_config.revision.v1';

const POSITIVE_POSTGRES_BIGINT = /^[1-9][0-9]{0,18}$/;
const MAX_POSTGRES_BIGINT = 9223372036854775807n;

function asRevisionString(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? String(value) : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes an internally generated positive PostgreSQL BIGINT revision
 * without converting the value through an unsafe JavaScript number.
 */
export function normalizePositiveAiProviderConfigurationRevision(value) {
  const normalized = asRevisionString(value);
  if (!POSITIVE_POSTGRES_BIGINT.test(normalized) || BigInt(normalized) > MAX_POSTGRES_BIGINT) {
    throw new TypeError('AI provider configuration revision is invalid.');
  }
  return normalized;
}

/**
 * Serializes all singleton AI provider configuration writes, including the
 * first-row case where SELECT FOR UPDATE cannot lock a missing row. This
 * transaction-level advisory lock is released automatically on commit or
 * rollback and carries no provider configuration data.
 */
export async function acquireAiProviderConfigurationRevisionWriteLock(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('AI provider configuration revision lock requires a database query client.');
  }

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [AI_PROVIDER_CONFIGURATION_REVISION_LOCK_NAME],
  );
}
