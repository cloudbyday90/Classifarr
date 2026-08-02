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

import path from 'node:path';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_AUTHORIZATION_TTL_MS =
  5 * 60 * 1000;
const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MAX_AUTHORIZATION_TTL_MS =
  30 * 60 * 1000;
const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MIN_AUTHORIZATION_TTL_MS = 1000;

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS = Object.freeze({
  AUTHORIZATION_TTL_MS: 'POLICY_COMPATIBILITY_NAMED_SCOPE_AUTHORIZATION_TTL_MS',
  EVIDENCE_ROOT: 'POLICY_COMPATIBILITY_NAMED_SCOPE_EVIDENCE_ROOT',
  REPOSITORY_ROOT: 'POLICY_COMPATIBILITY_NAMED_SCOPE_REPOSITORY_ROOT',
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAuthorizationTtlMs(value) {
  if (value === undefined || value === null || value === '') {
    return POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_AUTHORIZATION_TTL_MS;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) ||
      parsedValue < POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MIN_AUTHORIZATION_TTL_MS ||
      parsedValue > POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MAX_AUTHORIZATION_TTL_MS) {
    return null;
  }

  return parsedValue;
}

function resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration({
  environment = process.env,
  pathModule = path,
} = {}) {
  const evidenceRoot = cleanString(
    environment?.[POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.EVIDENCE_ROOT]
  );
  const repoRoot = cleanString(
    environment?.[POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.REPOSITORY_ROOT]
  );
  const authorizationTtlMs = resolveAuthorizationTtlMs(
    environment?.[POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS
      .AUTHORIZATION_TTL_MS]
  );
  const issueIds = [
    !repoRoot ? 'repository_root_missing' : null,
    repoRoot && !pathModule.isAbsolute(repoRoot) ? 'repository_root_not_absolute' : null,
    !evidenceRoot ? 'evidence_root_missing' : null,
    evidenceRoot && !pathModule.isAbsolute(evidenceRoot) ? 'evidence_root_not_absolute' : null,
    authorizationTtlMs === null ? 'authorization_ttl_invalid' : null,
  ].filter(Boolean);

  return {
    configuration: issueIds.length === 0 ? {
      authorizationTtlMs,
      evidenceRoot,
      repoRoot,
    } : null,
    validation: {
      issueCount: issueIds.length,
      issueIds,
      ok: issueIds.length === 0,
    },
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_AUTHORIZATION_TTL_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MAX_AUTHORIZATION_TTL_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_MIN_AUTHORIZATION_TTL_MS,
  resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration,
};
