/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  getVersion,
  preflightConnection,
} from './ollamaConnection.mjs';
import { generate } from './ollamaGeneration.mjs';

function isAsciiLetterOrDigit(character) {
  return (character >= '0' && character <= '9')
    || (character >= 'a' && character <= 'z')
    || (character >= 'A' && character <= 'Z');
}

function isValidHostnameLabel(label) {
  if (label.length === 0 || label.length > 63
    || !isAsciiLetterOrDigit(label[0])
    || !isAsciiLetterOrDigit(label[label.length - 1])) {
    return false;
  }

  return [...label].every((character) => isAsciiLetterOrDigit(character) || character === '-');
}

function isValidHostname(value) {
  return value.length <= 253
    && !value.startsWith('.')
    && !value.endsWith('.')
    && value.split('.').every(isValidHostnameLabel);
}

function isValidBracketedIpv6(value) {
  return value.length >= 4
    && value.startsWith('[')
    && value.endsWith(']')
    && [...value.slice(1, -1)].every((character) => (
      (character >= '0' && character <= '9')
      || (character >= 'a' && character <= 'f')
      || (character >= 'A' && character <= 'F')
      || character === ':'
      || character === '.'
    ));
}

function normalizeSavedHost(value) {
  const rawHost = String(value ?? '').trim();
  if (!rawHost) return null;

  if (/^https?:\/\//i.test(rawHost)) {
    try {
      const url = new URL(rawHost);
      if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        return null;
      }
      return Object.freeze({
        host: url.hostname,
        port: url.port ? Number(url.port) : null,
      });
    } catch {
      return null;
    }
  }

  return isValidHostname(rawHost) || isValidBracketedIpv6(rawHost)
    ? Object.freeze({ host: rawHost, port: null })
    : null;
}

function normalizeSavedPort(value) {
  const port = Number(value);
  return Number.isSafeInteger(port) && port > 0 && port <= 65_535 ? port : 11_434;
}

function buildSavedConfiguration(configuration = {}) {
  const savedHost = normalizeSavedHost(configuration.ollama_host);
  if (!savedHost) {
    throw new TypeError('Saved Ollama configuration has no valid local host.');
  }

  const port = savedHost.port || normalizeSavedPort(configuration.ollama_port);
  return Object.freeze({
    host: savedHost.host,
    port,
    model: String(configuration.ollama_model ?? '').trim() || null,
    baseUrl: `http://${savedHost.host}:${port}`,
  });
}

/**
 * Binds transport only to the existing saved AI configuration. It deliberately
 * has no browser-controlled target parameters and exposes no endpoint fields.
 */
export function createOllamaVerificationSavedConfigurationClient({ configuration } = {}) {
  const savedConfiguration = buildSavedConfiguration(configuration);
  const preflightCache = new Map();
  const getConfig = async () => savedConfiguration;

  return Object.freeze({
    preflightConnection(options = {}) {
      return preflightConnection(getConfig, preflightCache, {
        ...options,
        host: savedConfiguration.host,
        port: savedConfiguration.port,
      });
    },
    getVersion(options = {}) {
      return getVersion(getConfig, options);
    },
    generate(prompt, model, temperature, options = {}) {
      return generate(getConfig, prompt, model, temperature, options);
    },
  });
}
