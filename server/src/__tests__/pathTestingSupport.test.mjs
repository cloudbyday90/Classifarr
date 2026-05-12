/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildInvalidPathTestingMediaServerIdResponse,
  buildMissingPathTestingPathResponse,
  buildPathTranslationPayload,
  normalizePathAccessibilityRequest,
  normalizePathMappingsRequest,
  parsePathTestingMediaServerId,
} from '../routes/helpers/pathTestingSupport.mjs';

describe('pathTestingSupport', () => {
  test('builds the missing-path validation response', () => {
    expect(buildMissingPathTestingPathResponse()).toEqual({
      status: 400,
      body: { error: 'Path is required' },
    });
  });

  test('normalizes the path accessibility request when a path is present', () => {
    expect(normalizePathAccessibilityRequest({ path: '/media/movies' })).toEqual({
      payload: { path: '/media/movies' },
    });
  });

  test('builds the path translation payload from the route body', () => {
    expect(buildPathTranslationPayload({
      plexPath: '/plex',
      arrPath: '/arr',
      classiflarrPath: '/classifarr',
      sampleFile: 'Movie/file.mkv',
    })).toEqual({
      plexPath: '/plex',
      arrPath: '/arr',
      classiflarrPath: '/classifarr',
      sampleFile: 'Movie/file.mkv',
    });
  });

  test('parses a positive media server id', () => {
    expect(parsePathTestingMediaServerId('42')).toBe(42);
  });

  test('builds the invalid-media-server validation response', () => {
    expect(buildInvalidPathTestingMediaServerIdResponse()).toEqual({
      status: 400,
      body: { error: 'mediaServerId must be a positive integer' },
    });
  });

  test('normalizes mapping requests and rejects invalid ids', () => {
    expect(normalizePathMappingsRequest('42')).toEqual({
      payload: { mediaServerId: 42 },
    });
    expect(normalizePathMappingsRequest('nope')).toEqual({
      errorResponse: buildInvalidPathTestingMediaServerIdResponse(),
    });
  });
});
