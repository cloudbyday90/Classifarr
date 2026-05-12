/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildHeartbeatConfigResponse,
  normalizeProviderLockUpdatePayload,
  parseProviderLockInteger,
} from '../routes/helpers/providerLockSettingsSupport.mjs';

describe('providerLockSettingsSupport', () => {
  test('maps the in-memory provider-lock config to the route response shape', () => {
    expect(buildHeartbeatConfigResponse({
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000,
    })).toEqual({
      heartbeat_timeout: 30000,
      heartbeat_interval: 5000,
      max_wait_time: 120000,
    });
  });

  test('parses integer-like provider-lock values and preserves undefined', () => {
    expect(parseProviderLockInteger('45000')).toBe(45000);
    expect(parseProviderLockInteger(undefined)).toBeUndefined();
  });

  test('normalizes numeric-string provider-lock updates', () => {
    expect(normalizeProviderLockUpdatePayload({
      heartbeat_timeout: '45000',
      heartbeat_interval: '8000',
      max_wait_time: '180000',
    }, {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000,
    })).toEqual({
      payload: {
        heartbeatTimeout: 45000,
        heartbeatInterval: 8000,
        maxWaitTime: 180000,
      },
    });
  });

  test('returns validation errors for malformed integer values', () => {
    expect(normalizeProviderLockUpdatePayload({
      heartbeat_timeout: 'abc',
    }, {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000,
    })).toEqual({
      error: 'heartbeat_timeout must be an integer',
    });
  });

  test('validates the final interval against the final timeout', () => {
    expect(normalizeProviderLockUpdatePayload({
      heartbeat_interval: 30000,
    }, {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000,
    })).toEqual({
      error: 'heartbeat_interval must be less than heartbeat_timeout',
    });
  });
});
