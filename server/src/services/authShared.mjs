/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const ACCESS_TOKEN_EXPIRY = '15m';
export const SESSION_EXPIRY_HOURS = 48;
export const REMEMBER_ME_EXPIRY_DAYS = 30;
export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_DURATION_MINUTES = 15;

export function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }

  return { valid: true };
}

function getCookieMaxAge(rememberMe = false) {
  return rememberMe
    ? REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    : SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
}

export function getCookieOptions(isSecure = false, rememberMe = false) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: getCookieMaxAge(rememberMe),
  };
}

export function getRefreshTokenCookieOptions(isSecure = false, rememberMe = false) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: getCookieMaxAge(rememberMe),
  };
}
