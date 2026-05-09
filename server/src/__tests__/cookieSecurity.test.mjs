/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  isHttpsRequest,
  resolveSecureCookieFlag,
  _resetWarnStateForTests
} from '../utils/cookieSecurity.shared.js';

describe('cookieSecurity', () => {
  beforeEach(() => {
    _resetWarnStateForTests();
  });

  describe('isHttpsRequest', () => {
    it('returns true when req.secure is true', () => {
      expect(isHttpsRequest({ secure: true, headers: {} })).toBe(true);
    });

    it('returns true for x-forwarded-proto=https', () => {
      expect(isHttpsRequest({
        secure: false,
        headers: { 'x-forwarded-proto': 'https' }
      })).toBe(true);
    });

    it('returns false for non-https request', () => {
      expect(isHttpsRequest({
        secure: false,
        headers: { 'x-forwarded-proto': 'http' }
      })).toBe(false);
    });
  });

  describe('resolveSecureCookieFlag', () => {
    it('returns false when secure cookies are not forced', () => {
      expect(resolveSecureCookieFlag({ secure: true, headers: {} }, false)).toBe(false);
    });

    it('returns true when forced and request is https', () => {
      expect(resolveSecureCookieFlag({
        secure: false,
        headers: { 'x-forwarded-proto': 'https' }
      }, true)).toBe(true);
    });

    it('falls back to false when forced but request is http', () => {
      expect(resolveSecureCookieFlag({
        secure: false,
        headers: { 'x-forwarded-proto': 'http' }
      }, true)).toBe(false);
    });

    it('keeps strict true behavior when req is unavailable', () => {
      expect(resolveSecureCookieFlag(null, true)).toBe(true);
    });
  });
});
