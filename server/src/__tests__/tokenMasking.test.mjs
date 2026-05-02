/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isMaskedToken, maskToken } from '../utils/tokenMasking.mjs';

describe('tokenMasking.mjs', () => {
  test('maskToken returns empty string for non-string values', () => {
    expect(maskToken()).toBe('');
    expect(maskToken(null)).toBe('');
    expect(maskToken(1234)).toBe('');
  });

  test('maskToken preserves only the last four characters for long tokens', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('••••••••mnop');
  });

  test('maskToken uses a constant mask for short tokens', () => {
    expect(maskToken('abcd')).toBe('••••••••••••');
    expect(maskToken('xyz')).toBe('••••••••••••');
  });

  test('isMaskedToken recognizes the masked prefix only for strings', () => {
    expect(isMaskedToken('••••••••mnop')).toBe(true);
    expect(isMaskedToken('plain-token')).toBe(false);
    expect(isMaskedToken(null)).toBe(false);
  });
});
