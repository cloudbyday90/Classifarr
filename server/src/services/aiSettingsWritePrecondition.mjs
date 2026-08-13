/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const AI_SETTINGS_WRITE_PRECONDITION_HEADER = 'If-Match';
export const AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE =
  'ai_settings_write_precondition_required';
export const AI_SETTINGS_STALE_WRITE_CODE = 'ai_settings_stale_write';

export const AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_MESSAGE =
  'AI settings require the current write precondition. Reload the current settings and try again.';
export const AI_SETTINGS_STALE_WRITE_MESSAGE =
  'AI settings changed before this save. Reload the current settings and review them before saving again.';

// A stable bootstrap tag supports the legacy no-row state without making a
// read mutate configuration. It is accepted only while the singleton row is
// absent and is replaced by the database-generated UUID on the first save.
const BOOTSTRAP_WRITE_TAG = '00000000-0000-4000-8000-000000000001';
const UUID_V4_OR_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @typedef {Error & {
 *   code: string,
 *   httpStatus: number,
 *   reloadRequired: true,
 * }} AiSettingsWritePreconditionError
 */

function quoteStrongEntityTag(value) {
  return `\"${value}\"`;
}

function getConfigurationWriteTag(configuration) {
  if (!configuration || Object.keys(configuration).length === 0) {
    return BOOTSTRAP_WRITE_TAG;
  }

  const writeTag = configuration.configuration_write_tag;
  if (typeof writeTag !== 'string' || !UUID_V4_OR_V7.test(writeTag)) {
    throw new TypeError('AI settings write precondition state is unavailable.');
  }

  return writeTag.toLowerCase();
}

function normalizeProvidedPrecondition(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createPreconditionError({ code, httpStatus, message }) {
  const error = /** @type {AiSettingsWritePreconditionError} */ (new Error(message));
  error.code = code;
  error.httpStatus = httpStatus;
  error.reloadRequired = true;
  return error;
}

export function isAiSettingsWritePreconditionError(error) {
  return error?.code === AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE
    || error?.code === AI_SETTINGS_STALE_WRITE_CODE;
}

/**
 * Issues and verifies the opaque, strong entity tag for the singleton AI
 * settings resource. The UUID is a freshness capability, not authentication;
 * route authorization and CSRF protections remain responsible for access.
 */
export function createAiSettingsWritePreconditionService() {
  return Object.freeze({
    issueForConfiguration(configuration) {
      return quoteStrongEntityTag(getConfigurationWriteTag(configuration));
    },

    assertCurrent({ providedPrecondition, configuration }) {
      const provided = normalizeProvidedPrecondition(providedPrecondition);
      if (!provided) {
        throw createPreconditionError({
          code: AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_CODE,
          httpStatus: 428,
          message: AI_SETTINGS_WRITE_PRECONDITION_REQUIRED_MESSAGE,
        });
      }

      const expected = quoteStrongEntityTag(getConfigurationWriteTag(configuration));
      if (provided !== expected) {
        throw createPreconditionError({
          code: AI_SETTINGS_STALE_WRITE_CODE,
          httpStatus: 412,
          message: AI_SETTINGS_STALE_WRITE_MESSAGE,
        });
      }

      return expected;
    },
  });
}
