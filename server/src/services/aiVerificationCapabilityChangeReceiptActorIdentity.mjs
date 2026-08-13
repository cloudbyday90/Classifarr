/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const USER_ID_PATTERN = /^[A-Za-z0-9:_-]{1,150}$/;
const ACTOR_ID_PATTERN = /^user:[A-Za-z0-9:_-]{1,150}$/;

/**
 * Converts the authenticated administrator identity into the only actor
 * reference stored on a verification-capability receipt. The client never
 * supplies or selects this value.
 */
export function getAiVerificationCapabilityChangeReceiptActorId(user = {}) {
  const userId = String(user?.id ?? '').trim();
  return USER_ID_PATTERN.test(userId) ? `user:${userId}` : null;
}

export function isAiVerificationCapabilityChangeReceiptActorId(value) {
  return typeof value === 'string' && ACTOR_ID_PATTERN.test(value.trim());
}
