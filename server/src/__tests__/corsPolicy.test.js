/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { evaluateCorsOrigin } = require('../utils/corsPolicy');

describe('corsPolicy', () => {
  test('allows requests without an Origin header', () => {
    expect(evaluateCorsOrigin(undefined, [])).toEqual({ value: true, reject: false });
  });

  test('does not reflect arbitrary origins when no allowlist is configured', () => {
    expect(evaluateCorsOrigin('https://evil.example', [])).toEqual({ value: false, reject: false });
  });

  test('allows configured origins', () => {
    expect(evaluateCorsOrigin('https://app.example', ['https://app.example'])).toEqual({
      value: 'https://app.example',
      reject: false,
    });
  });

  test('allows wildcard mode by reflecting the caller origin', () => {
    expect(evaluateCorsOrigin('https://app.example', ['*'])).toEqual({
      value: 'https://app.example',
      reject: false,
    });
  });

  test('rejects unlisted origins when an allowlist exists', () => {
    expect(evaluateCorsOrigin('https://evil.example', ['https://app.example'])).toEqual({
      value: false,
      reject: true,
    });
  });
});
