/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import { maskToken } from '../utils/tokenMasking.mjs';
import {
  ALLOWED_ARR_CONFIG_TABLES,
  buildArrConfigShape,
  buildArrCreatePayload,
  buildArrUpdatePayload,
  createArrConfigError,
  maskArrConfigRow,
  parseArrConfigId,
  validateArrConfigTable,
} from '../services/shared/arrConfigModel.mjs';

describe('arrConfigModel', () => {
  test('validateArrConfigTable accepts supported tables and rejects unsupported ones', () => {
    expect(ALLOWED_ARR_CONFIG_TABLES.has('radarr_config')).toBe(true);
    expect(ALLOWED_ARR_CONFIG_TABLES.has('sonarr_config')).toBe(true);
    expect(() => validateArrConfigTable('radarr_config')).not.toThrow();
    expect(() => validateArrConfigTable('bad_table')).toThrow('Unsupported ARR config table: bad_table');
  });

  test('createArrConfigError attaches httpStatus', () => {
    const error = createArrConfigError('boom', 418);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
    expect(error.httpStatus).toBe(418);
  });

  test('maskArrConfigRow masks api keys without mutating the input', () => {
    const row = {
      id: 1,
      name: 'Radarr',
      api_key: 'super-secret',
    };

    const masked = maskArrConfigRow(row);

    expect(masked).not.toBe(row);
    expect(masked.api_key).not.toBe('super-secret');
    expect(masked.api_key.startsWith('•')).toBe(true);
    expect(row.api_key).toBe('super-secret');
  });

  test('parseArrConfigId returns only positive integers', () => {
    expect(parseArrConfigId('5')).toBe(5);
    expect(parseArrConfigId(7)).toBe(7);
    expect(parseArrConfigId('0')).toBeNull();
    expect(parseArrConfigId('-1')).toBeNull();
    expect(parseArrConfigId('abc')).toBeNull();
  });

  test('buildArrConfigShape uses defaults and constructs url when omitted', () => {
    const shape = buildArrConfigShape({
      host: 'radarr.local',
      base_path: '/api',
    }, 7878);

    expect(shape).toEqual({
      protocol: 'http',
      host: 'radarr.local',
      port: 7878,
      base_path: '/api',
      url: 'http://radarr.local:7878/api',
    });
  });

  test('buildArrConfigShape preserves explicit url and existing values', () => {
    const shape = buildArrConfigShape({
      name: 'ignored',
      url: 'https://custom.example/base',
      port: '9090',
    }, 7878, {
      protocol: 'https',
      host: 'existing.local',
      port: 8989,
      base_path: '/old',
    });

    expect(shape).toEqual({
      protocol: 'https',
      host: 'existing.local',
      port: 9090,
      base_path: '/old',
      url: 'https://custom.example/base',
    });
  });

  test('buildArrCreatePayload applies defaults for extra columns', () => {
    const payload = buildArrCreatePayload({
      body: {
        name: 'Radarr Main',
        host: 'radarr.local',
        api_key: 'key-1',
      },
      defaultPort: 7878,
      createDefaults: {
        quality_profile_id: null,
        minimum_availability: 'released',
      },
      extraColumns: ['quality_profile_id', 'minimum_availability'],
    });

    expect(payload).toEqual({
      name: 'Radarr Main',
      url: 'http://radarr.local:7878',
      api_key: 'key-1',
      protocol: 'http',
      host: 'radarr.local',
      port: 7878,
      base_path: '',
      verify_ssl: true,
      timeout: 30,
      quality_profile_id: null,
      minimum_availability: 'released',
    });
  });

  test('buildArrUpdatePayload preserves masked keys and existing extra fields', () => {
    const payload = buildArrUpdatePayload({
      body: {
        name: 'Updated Radarr',
        api_key: maskToken('live-api-key'),
        verify_ssl: false,
      },
      existing: {
        name: 'Radarr Main',
        api_key: 'live-api-key',
        protocol: 'https',
        host: 'radarr.local',
        port: 7878,
        base_path: '/base',
        verify_ssl: true,
        timeout: 45,
        is_active: true,
        quality_profile_id: 7,
      },
      defaultPort: 7878,
      extraColumns: ['quality_profile_id'],
    });

    expect(payload).toEqual({
      name: 'Updated Radarr',
      url: 'https://radarr.local:7878/base',
      api_key: 'live-api-key',
      protocol: 'https',
      host: 'radarr.local',
      port: 7878,
      base_path: '/base',
      verify_ssl: false,
      timeout: 45,
      is_active: true,
      quality_profile_id: 7,
    });
  });
});
