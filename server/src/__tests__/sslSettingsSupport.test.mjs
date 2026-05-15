/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  DEFAULT_SSL_CONFIG,
  normalizeSslConfig,
  presentSslConfig,
} from '../routes/helpers/sslSettingsSupport.mjs';

describe('sslSettingsSupport', () => {
  test('normalizes SSL config updates against stored values and defaults', () => {
    expect(normalizeSslConfig({
      force_https: true,
      cert_path: '',
      hsts_max_age: 'bad-value',
    }, {
      enabled: true,
      cert_path: '/certs/live.crt',
      key_path: '/certs/live.key',
      ca_path: '/certs/ca.pem',
      force_https: false,
      hsts_enabled: true,
      hsts_max_age: 86400,
      client_cert_required: true,
    })).toEqual({
      enabled: true,
      cert_path: null,
      key_path: '/certs/live.key',
      ca_path: '/certs/ca.pem',
      force_https: true,
      hsts_enabled: true,
      hsts_max_age: 86400,
      client_cert_required: true,
    });

    expect(normalizeSslConfig({ cert_path: '', key_path: '', ca_path: '', hsts_max_age: -1 }, null)).toEqual({
      enabled: DEFAULT_SSL_CONFIG.enabled,
      cert_path: null,
      key_path: null,
      ca_path: null,
      force_https: DEFAULT_SSL_CONFIG.force_https,
      hsts_enabled: DEFAULT_SSL_CONFIG.hsts_enabled,
      hsts_max_age: DEFAULT_SSL_CONFIG.hsts_max_age,
      client_cert_required: DEFAULT_SSL_CONFIG.client_cert_required,
    });
  });

  test('presents SSL config rows with empty-string path fallbacks', () => {
    expect(presentSslConfig(null)).toEqual(DEFAULT_SSL_CONFIG);
    expect(presentSslConfig({
      enabled: true,
      cert_path: null,
      key_path: '/certs/live.key',
      ca_path: null,
    })).toEqual(expect.objectContaining({
      enabled: true,
      cert_path: '',
      key_path: '/certs/live.key',
      ca_path: '',
    }));
  });
});
