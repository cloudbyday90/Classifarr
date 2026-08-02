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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';

import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalApply.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock,
  derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS,
  createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionAdapter,
  createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionFromEnvironment,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalProductionAdmission.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS,
  resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfig.mjs';
import {
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalReviewArtifact.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter.mjs';
import {
  REVIEW_TIME,
  buildScopeRemovalReviewFixture,
  readyPreApplyVerification,
  reviewMetadata,
} from './fixtures/policyControlledCompatibilityNamedScopeRemovalReviewFixtures.mjs';

const ADMIN_REQUEST = Object.freeze({ user: Object.freeze({ id: 7, role: 'admin' }) });

function buildAdmissionFixture({ evidenceRoot, fixtureRoot, withSessionAdvisoryLock } = {}) {
  const fixture = buildScopeRemovalReviewFixture({ fixtureRoot });
  const review = reviewMetadata();
  const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
    review,
    scopeRemovalDryRun: fixture.scopeRemovalDryRun,
  });
  const getServerReviewContext = jest.fn(async () => ({
    executionGate: fixture.executionGate,
    review,
    reviewArtifact,
    selectedEntryIdentity: fixture.selectedEntryIdentity,
  }));
  const adapter = createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionAdapter({
    evidenceRoot,
    getServerReviewContext,
    now: () => REVIEW_TIME,
    replayAdapterFactory: ({ now, repoRoot }) =>
      createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
        now,
        preApplyChangeDetector: readyPreApplyVerification,
        repoRoot,
      }),
    repoRoot: fixtureRoot,
    withSessionAdvisoryLock,
  });

  return { adapter, fixture, getServerReviewContext };
}

describe('policyControlledCompatibilityNamedScopeRemovalProductionAdmission', () => {
  let evidenceRoot;
  let fixtureRoot;

  beforeEach(() => {
    evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-production-admission-evidence-'));
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-production-admission-repo-'));
  });

  afterEach(() => {
    fs.rmSync(evidenceRoot, { force: true, recursive: true });
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('derives the actor from authenticated middleware state and applies under a database scope lock', async () => {
    const withSessionAdvisoryLock = jest.fn(async (_lockKey, callback) => {
      await callback();
      return true;
    });
    const { adapter, fixture, getServerReviewContext } = buildAdmissionFixture({
      evidenceRoot,
      fixtureRoot,
      withSessionAdvisoryLock,
    });

    const issued = await adapter.issue({
      actor: { id: 'attacker', role: 'admin' },
      authenticatedRequest: ADMIN_REQUEST,
      reviewContext: { attackerSupplied: true },
    });
    const applied = await adapter.apply({
      actor: { id: 'attacker', role: 'admin' },
      authenticatedRequest: ADMIN_REQUEST,
      authorizationId: issued.authorization.authorizationId,
      now: '2000-01-01T00:00:00.000Z',
    });

    expect(issued).toEqual(expect.objectContaining({
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
        .ISSUED,
    }));
    expect(getServerReviewContext).toHaveBeenCalledWith();
    expect(applied).toEqual(expect.objectContaining({
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
        .APPLY_COMPLETED,
      apply: expect.objectContaining({
        statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      }),
    }));
    expect(withSessionAdvisoryLock).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Function)
    );
    expect(withSessionAdvisoryLock.mock.calls[0][0]).toBeLessThan(0);
    const updatedSource = fs.readFileSync(fixture.sourcePath, 'utf8');
    expect(updatedSource).not.toContain('removes legacy alpha');
    expect(updatedSource).not.toContain('removes legacy beta');
  });

  test('blocks unauthenticated, non-admin, and API-key-only request state before review or lock access', async () => {
    const withSessionAdvisoryLock = jest.fn();
    const { adapter, getServerReviewContext } = buildAdmissionFixture({
      evidenceRoot,
      fixtureRoot,
      withSessionAdvisoryLock,
    });

    const missingUser = await adapter.issue({ authenticatedRequest: {} });
    const nonAdmin = await adapter.issue({
      authenticatedRequest: { user: { id: 7, role: 'operator' } },
    });
    const apiKeyOnly = await adapter.apply({
      authenticatedRequest: { apiKey: { id: 'admin-api-key' } },
      authorizationId: '3e53a00d-8dac-4772-a332-ae08bfe947b2',
    });

    [missingUser, nonAdmin, apiKeyOnly].forEach(result => {
      expect(result.statusId).toBe(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
          .BLOCKED_BY_AUTHENTICATED_ACTOR
      );
      expect(result.riskIds).toEqual([
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
          .AUTHENTICATED_ADMIN_REQUIRED,
      ]);
    });
    expect(getServerReviewContext).not.toHaveBeenCalled();
    expect(withSessionAdvisoryLock).not.toHaveBeenCalled();
  });

  test('blocks issue when its server-owned review-context provider fails', async () => {
    const withSessionAdvisoryLock = jest.fn();
    const { adapter, getServerReviewContext } = buildAdmissionFixture({
      evidenceRoot,
      fixtureRoot,
      withSessionAdvisoryLock,
    });
    getServerReviewContext.mockRejectedValueOnce(new Error('server review unavailable'));

    const result = await adapter.issue({
      authenticatedRequest: ADMIN_REQUEST,
      reviewContext: { attackerSupplied: true },
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_STATUS_IDS
        .BLOCKED_BY_REVIEW_CONTEXT
    );
    expect(result.riskIds).toEqual([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_PRODUCTION_ADMISSION_RISK_IDS
        .REVIEW_CONTEXT_UNAVAILABLE,
    ]);
    expect(fs.existsSync(path.join(evidenceRoot, 'pending'))).toBe(false);
    expect(withSessionAdvisoryLock).not.toHaveBeenCalled();
  });

  test('does not consume authorization when the database lock is unavailable', async () => {
    const withSessionAdvisoryLock = jest.fn(async () => false);
    const { adapter, fixture } = buildAdmissionFixture({
      evidenceRoot,
      fixtureRoot,
      withSessionAdvisoryLock,
    });
    const issued = await adapter.issue({ authenticatedRequest: ADMIN_REQUEST });
    const originalSource = fs.readFileSync(fixture.sourcePath, 'utf8');

    const result = await adapter.apply({
      authenticatedRequest: ADMIN_REQUEST,
      authorizationId: issued.authorization.authorizationId,
    });

    expect(result.apply.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.BLOCKED_BY_LOCK
    );
    expect(fs.readFileSync(fixture.sourcePath, 'utf8')).toBe(originalSource);
    expect(fs.existsSync(path.join(evidenceRoot, 'consumed', `${issued.authorization.authorizationId}.json`)))
      .toBe(false);
  });

  test('uses deterministic negative advisory keys and preserves callback results only when acquired', async () => {
    const scopeIdentity = 'named_test_scope:1234567890abcdef';
    const withSessionAdvisoryLock = jest.fn(async (_lockKey, callback) => {
      await callback();
      return true;
    });
    const scopeLock = createPolicyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock({
      withSessionAdvisoryLock,
    });

    const acquired = await scopeLock.withScopeLock({ scopeIdentity }, async () => 'completed');
    withSessionAdvisoryLock.mockResolvedValueOnce(false);
    const unavailable = await scopeLock.withScopeLock({ scopeIdentity }, async () => 'not-run');

    expect(derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey(scopeIdentity))
      .toBe(derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey(scopeIdentity));
    expect(derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey(scopeIdentity)).toBeLessThan(0);
    expect(derivePolicyControlledCompatibilityNamedScopeRemovalAdvisoryLockKey('path:unsafe')).toBeNull();
    expect(acquired).toEqual({ acquired: true, value: 'completed' });
    expect(unavailable).toEqual({ acquired: false });
  });

  test('requires explicit absolute environment roots and a bounded authorization TTL', () => {
    const missing = resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration({
      environment: {},
    });
    const valid = resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration({
      environment: {
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.EVIDENCE_ROOT]:
          evidenceRoot,
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.REPOSITORY_ROOT]:
          fixtureRoot,
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.AUTHORIZATION_TTL_MS]:
          '600000',
      },
    });
    const invalidTtl = resolvePolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfiguration({
      environment: {
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.EVIDENCE_ROOT]:
          evidenceRoot,
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.REPOSITORY_ROOT]:
          fixtureRoot,
        [POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ENVIRONMENT_KEYS.AUTHORIZATION_TTL_MS]:
          '1800001',
      },
    });

    expect(missing.validation.issueIds).toEqual(expect.arrayContaining([
      'evidence_root_missing',
      'repository_root_missing',
    ]));
    expect(valid).toEqual(expect.objectContaining({
      configuration: expect.objectContaining({ authorizationTtlMs: 600000 }),
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(invalidTtl.validation.issueIds).toEqual(['authorization_ttl_invalid']);
    expect(() => createPolicyControlledCompatibilityNamedScopeRemovalProductionAdmissionFromEnvironment({
      environment: {},
      getServerReviewContext: async () => ({}),
      withSessionAdvisoryLock: async () => false,
    })).toThrow('production admission environment is invalid');
  });
});
