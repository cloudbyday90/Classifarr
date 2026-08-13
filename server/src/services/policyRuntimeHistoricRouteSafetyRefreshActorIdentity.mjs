/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const USER_ID_PATTERN = /^[A-Za-z0-9:_-]{1,150}$/;
const ACTOR_ID_PATTERN = /^user:[A-Za-z0-9:_-]{1,150}$/;

/**
 * Converts an authenticated user identity to the receipt ownership reference.
 * The browser never supplies this value.
 */
export function getHistoricRouteSafetyRefreshActorId(user = {}) {
  const userId = String(user?.id ?? '').trim();
  return USER_ID_PATTERN.test(userId) ? `user:${userId}` : null;
}

export function isHistoricRouteSafetyRefreshActorId(value) {
  return typeof value === 'string' && ACTOR_ID_PATTERN.test(value.trim());
}
