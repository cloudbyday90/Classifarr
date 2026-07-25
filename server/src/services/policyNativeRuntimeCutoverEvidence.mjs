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

import {
  attachActiveNativeIntentsForPolicies,
} from './policyNativePolicyReadService.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from './policyNativeRuntimeCutoverVerification.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAuthoritativeNativeIntent(policy = {}) {
  return policy?.native_intent_authority?.authoritative === true;
}

async function loadEnabledPolicyNativeRuntimeReadModels(dbClient) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const result = await dbClient.query(`
    SELECT
      policy.*,
      library.name AS library_name,
      library.media_type AS library_media_type
    FROM library_policies policy
    INNER JOIN libraries library ON library.id = policy.library_id
    WHERE policy.enabled = TRUE
    ORDER BY policy.id ASC
  `);

  return attachActiveNativeIntentsForPolicies({
    dbClient,
    policies: asArray(result.rows),
  });
}

async function loadPolicyNativeRuntimeCutoverVerification(
  dbClient,
  {
    rollbackAvailable = false,
    legacyDeletionBlocked = true,
    supportDiagnosticsSafe = true,
    generatedAt = null,
  } = {}
) {
  const policies = await loadEnabledPolicyNativeRuntimeReadModels(dbClient);
  const convertedPolicies = policies.filter(hasAuthoritativeNativeIntent);
  const unconvertedPolicies = policies.filter(policy => !hasAuthoritativeNativeIntent(policy));

  return buildPolicyNativeRuntimeCutoverVerification({
    convertedPolicies,
    unconvertedPolicies,
    rollbackAvailable,
    legacyDeletionBlocked,
    supportDiagnosticsSafe,
    generatedAt,
  });
}

export {
  hasAuthoritativeNativeIntent,
  loadEnabledPolicyNativeRuntimeReadModels,
  loadPolicyNativeRuntimeCutoverVerification,
};
