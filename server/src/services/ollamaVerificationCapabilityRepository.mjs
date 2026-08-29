/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  resolveOllamaVerificationCapabilityIdentity,
} from './ollamaVerificationCapabilityIdentity.mjs';

const CAPABILITY_COLUMNS = `
  primary_provider,
  ollama_host,
  ollama_port,
  ollama_model,
  configuration_revision,
  ollama_verification_capability_status,
  ollama_verification_capability_fingerprint,
  ollama_verification_capability_configuration_revision,
  ollama_verification_capability_model_digest,
  ollama_verification_capability_checked_at,
  ollama_verification_capability_error_code,
  ollama_verification_capability_latency_ms
`;

export class OllamaVerificationCapabilityConfigurationChangedError extends Error {
  constructor() {
    super('The AI configuration changed while the Ollama verification test was running. Reload the saved settings and test again.');
    this.name = 'OllamaVerificationCapabilityConfigurationChangedError';
    this.code = 'ollama_verification_capability_configuration_changed';
  }
}

export async function loadOllamaVerificationCapabilityConfiguration(database) {
  const result = await database.query(`
    SELECT ${CAPABILITY_COLUMNS}
    FROM ai_provider_config
    WHERE id = 1
  `);
  return result.rows?.[0] || null;
}

/**
 * Stores only the bounded probe verdict and a non-reversible configuration
 * fingerprint. No provider endpoint, model name, prompt, response, or
 * credential is copied into capability state.
 */
export async function persistOllamaVerificationCapabilityProbe({ client, identity, outcome }) {
  const currentResult = await client.query(`
    SELECT ${CAPABILITY_COLUMNS}
    FROM ai_provider_config
    WHERE id = 1
    FOR UPDATE
  `);
  const currentConfiguration = currentResult.rows?.[0] || null;
  const currentIdentity = resolveOllamaVerificationCapabilityIdentity(currentConfiguration || {});

  if (!currentIdentity.applicable
    || currentIdentity.configurationRevision !== identity.configurationRevision
    || currentIdentity.fingerprint !== identity.fingerprint) {
    throw new OllamaVerificationCapabilityConfigurationChangedError();
  }

  const result = await client.query(`
    UPDATE ai_provider_config
    SET
      ollama_verification_capability_status = $1,
      ollama_verification_capability_fingerprint = $2,
      ollama_verification_capability_configuration_revision = $3,
      ollama_verification_capability_model_digest = $4,
      ollama_verification_capability_checked_at = $5::timestamptz,
      ollama_verification_capability_error_code = $6,
      ollama_verification_capability_latency_ms = $7
    WHERE id = 1
    RETURNING ${CAPABILITY_COLUMNS}
  `, [
    outcome.statusId,
    outcome.configurationFingerprint,
    outcome.configurationRevision,
    outcome.modelDigest,
    outcome.checkedAt,
    outcome.errorCode,
    outcome.latencyMs,
  ]);

  return result.rows?.[0] || null;
}
