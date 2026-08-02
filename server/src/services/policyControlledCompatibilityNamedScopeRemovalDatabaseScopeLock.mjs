/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';

const NAMED_SCOPE_IDENTITY_PREFIX = 'named_test_scope:';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey(scopeIdentity) {
  const normalizedScopeIdentity = cleanString(scopeIdentity);
  if (!normalizedScopeIdentity.startsWith(NAMED_SCOPE_IDENTITY_PREFIX)) return null;

  const digest = createHash('sha256').update(normalizedScopeIdentity).digest();

  // Keep this namespace negative so it cannot collide with the app's positive static lock IDs.
  return -1 - (digest.readUInt32BE(0) % 2147483647);
}

function createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock({
  withSessionAdvisoryLock,
} = {}) {
  if (typeof withSessionAdvisoryLock !== 'function') {
    throw new Error('Controlled scope removal requires the database advisory-lock service.');
  }

  async function withScopeLock({ scopeIdentity } = {}, callback) {
    const lockKey = derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey(
      scopeIdentity
    );
    if (lockKey === null || typeof callback !== 'function') {
      throw new Error('Controlled scope removal scope lock input is invalid.');
    }

    let value;
    const acquired = await withSessionAdvisoryLock(lockKey, async () => {
      value = await callback();
    });

    return acquired === true ? { acquired: true, value } : { acquired: false };
  }

  return { withScopeLock };
}

export {
  createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock,
  derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey,
};
