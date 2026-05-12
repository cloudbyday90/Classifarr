/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  normalizeSetupMediaPath,
  sendSetupErrorResponse,
} from '../routes/helpers/setupSupport.mjs';

describe('setupSupport', () => {
  test('normalizes setup media paths by trimming strings and blanking non-strings', () => {
    expect(normalizeSetupMediaPath('  /media  ')).toBe('/media');
    expect(normalizeSetupMediaPath('   ')).toBe('');
    expect(normalizeSetupMediaPath(undefined)).toBe('');
    expect(normalizeSetupMediaPath(null)).toBe('');
  });

  test('applies the shared setup plain-error response shape', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    sendSetupErrorResponse(res, new Error('setup failed'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'setup failed' });
  });
});