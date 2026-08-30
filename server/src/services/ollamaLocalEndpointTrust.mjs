/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isIP } from 'node:net';

const TRUSTED_DOCKER_SERVICE_HOSTS = new Set(['ollama']);

function parseHostname(value) {
  const rawHost = String(value ?? '').trim();
  if (!rawHost) return null;

  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(rawHost) ? rawHost : `http://${rawHost}`,
    );
    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) {
      return null;
    }

    return url.hostname.replace(/^\[|\]$/g, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function isPrivateIpv4(host) {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;

  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isPrivateIpv6(host) {
  const firstSegment = Number.parseInt(host.split(':', 1)[0], 16);
  return host === '::1'
    || (Number.isInteger(firstSegment) && firstSegment >= 0xfc00 && firstSegment <= 0xfdff)
    || (Number.isInteger(firstSegment) && firstSegment >= 0xfe80 && firstSegment <= 0xfebf);
}

/**
 * Classifies only syntactically provable local endpoints. It deliberately does
 * not resolve hostnames: DNS results can vary and must not expand the detailed
 * evidence boundary. Unknown hosts receive the remote-safe evidence projection.
 */
export function isTrustedLocalOllamaEndpoint(value) {
  const host = parseHostname(value);
  if (!host) return false;
  if (host === 'localhost' || TRUSTED_DOCKER_SERVICE_HOSTS.has(host)) return true;

  const addressFamily = isIP(host);
  if (addressFamily === 4) return isPrivateIpv4(host);
  if (addressFamily === 6) return isPrivateIpv6(host);
  return false;
}
