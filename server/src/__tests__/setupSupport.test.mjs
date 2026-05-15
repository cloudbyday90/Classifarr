/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  normalizeSetupMediaPath,
} from '../routes/helpers/setupSupport.mjs';

describe('setupSupport', () => {
  test('normalizes setup media paths by trimming strings and blanking non-strings', () => {
    expect(normalizeSetupMediaPath('  /media  ')).toBe('/media');
    expect(normalizeSetupMediaPath('   ')).toBe('');
    expect(normalizeSetupMediaPath(undefined)).toBe('');
    expect(normalizeSetupMediaPath(null)).toBe('');
  });
});