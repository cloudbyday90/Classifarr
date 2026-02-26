/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

let warnedInsecureFallback = false;

function isHttpsRequest(req) {
  if (!req) return false;

  if (req.secure === true) {
    return true;
  }

  const forwardedProtoHeader = req.headers && req.headers['x-forwarded-proto'];
  if (!forwardedProtoHeader) {
    return false;
  }

  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const primaryProto = String(forwardedProto).split(',')[0].trim().toLowerCase();

  return primaryProto === 'https';
}

/**
 * Compatibility-safe secure-cookie resolver:
 * - If force secure is disabled, always false.
 * - If force secure is enabled and request is HTTPS, true.
 * - If force secure is enabled but request is HTTP, fall back to false to avoid lockouts.
 */
function resolveSecureCookieFlag(req, forceSecureConfigured) {
  if (!forceSecureConfigured) {
    return false;
  }

  // Preserve strict behavior for non-request contexts.
  if (!req) {
    return true;
  }

  if (isHttpsRequest(req)) {
    return true;
  }

  if (!warnedInsecureFallback) {
    warnedInsecureFallback = true;
    console.warn(
      'FORCE_SECURE_COOKIES is enabled but request is not HTTPS; using non-secure cookies for compatibility.'
    );
  }

  return false;
}

function _resetWarnStateForTests() {
  warnedInsecureFallback = false;
}

module.exports = {
  isHttpsRequest,
  resolveSecureCookieFlag,
  _resetWarnStateForTests
};
