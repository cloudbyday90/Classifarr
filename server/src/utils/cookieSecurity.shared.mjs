import { createLogger } from './logger.mjs';

const logger = createLogger('cookieSecurity');

let warnedInsecureFallback = false;

export function isHttpsRequest(req) {
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

export function resolveSecureCookieFlag(req, forceSecureConfigured) {
  if (!forceSecureConfigured) {
    return false;
  }

  if (!req) {
    return true;
  }

  if (isHttpsRequest(req)) {
    return true;
  }

  if (!warnedInsecureFallback) {
    warnedInsecureFallback = true;
    logger.warn(
      'FORCE_SECURE_COOKIES is enabled but request is not HTTPS; using non-secure cookies for compatibility.'
    );
  }

  return false;
}

export function _resetWarnStateForTests() {
  warnedInsecureFallback = false;
}


