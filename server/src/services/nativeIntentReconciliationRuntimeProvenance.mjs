/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import packageJson from '../../package.json' with { type: 'json' };

const UNKNOWN_RUNTIME_APP_VERSION = 'unknown';
const RUNTIME_APP_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,79}$/u;
const RUNTIME_BUILD_REVISION_PATTERN = /^[0-9a-f]{7,64}$/iu;

function normalizeRuntimeAppVersion(value, fallback = UNKNOWN_RUNTIME_APP_VERSION) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (RUNTIME_APP_VERSION_PATTERN.test(normalized)) return normalized;

  const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : '';
  return RUNTIME_APP_VERSION_PATTERN.test(normalizedFallback)
    ? normalizedFallback
    : UNKNOWN_RUNTIME_APP_VERSION;
}

function normalizeRuntimeBuildRevision(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return RUNTIME_BUILD_REVISION_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function normalizeNativeIntentReconciliationRuntimeProvenance(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    appVersion: normalizeRuntimeAppVersion(source.appVersion),
    buildRevision: normalizeRuntimeBuildRevision(source.buildRevision),
    rawPayloadExposed: false,
  };
}

function getNativeIntentReconciliationRuntimeProvenance({
  environment = process.env,
  packageVersion = packageJson.version,
} = {}) {
  const source = environment && typeof environment === 'object' ? environment : {};

  return normalizeNativeIntentReconciliationRuntimeProvenance({
    appVersion: source.CLASSIFARR_APP_VERSION || source.APP_VERSION || packageVersion,
    buildRevision: source.CLASSIFARR_BUILD_REVISION,
  });
}

export {
  UNKNOWN_RUNTIME_APP_VERSION,
  getNativeIntentReconciliationRuntimeProvenance,
  normalizeNativeIntentReconciliationRuntimeProvenance,
  normalizeRuntimeAppVersion,
  normalizeRuntimeBuildRevision,
};
