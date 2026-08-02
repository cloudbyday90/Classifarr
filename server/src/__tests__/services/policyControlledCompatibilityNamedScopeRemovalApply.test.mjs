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

import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS,
  createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter,
  validatePolicyControlledCompatibilityNamedScopeRemovalApply,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalApply.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalApplyOperationStore.mjs';
import {
  createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs';
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
  sourceText,
} from './fixtures/policyControlledCompatibilityNamedScopeRemovalReviewFixtures.mjs';

const ACTOR = Object.freeze({ id: '7', role: 'admin' });
const EXPIRY_TIME = '2026-07-14T20:10:00.000Z';

function acquiredScopeLock() {
  return {
    async withScopeLock(_scope, callback) {
      return { acquired: true, value: await callback() };
    },
  };
}

function buildApplyFixture({ applyTime = REVIEW_TIME, evidenceRoot, fixtureRoot } = {}) {
  const fixture = buildScopeRemovalReviewFixture({ fixtureRoot });
  const review = reviewMetadata();
  const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
    review,
    scopeRemovalDryRun: fixture.scopeRemovalDryRun,
  });
  const authorizationStore = createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore({
    evidenceRoot,
    now: () => REVIEW_TIME,
    repoRoot: fixtureRoot,
  });
  const replayAdapter = createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
    now: REVIEW_TIME,
    preApplyChangeDetector: readyPreApplyVerification,
    repoRoot: fixtureRoot,
  });
  const applyAdapter = createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter({
    authorizationStore,
    replayAdapter,
    now: applyTime,
    repoRoot: fixtureRoot,
    scopeLock: acquiredScopeLock(),
    sourceWriter: createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter(),
  });

  return {
    applyAdapter,
    authorizationStore,
    fixture,
    review,
    reviewArtifact,
  };
}

async function issueAuthorization({ authorizationStore, fixture, review, reviewArtifact } = {}) {
  return authorizationStore.issueAuthorization({
    actor: ACTOR,
    expiresAt: EXPIRY_TIME,
    reviewContext: {
      executionGate: fixture.executionGate,
      review,
      reviewArtifact,
      selectedEntryIdentity: fixture.selectedEntryIdentity,
    },
  });
}

describe('policyControlledCompatibilityNamedScopeRemovalApply', () => {
  let evidenceRoot;
  let fixtureRoot;

  beforeEach(() => {
    evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-named-scope-evidence-'));
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-named-scope-apply-'));
  });

  afterEach(() => {
    fs.rmSync(evidenceRoot, { force: true, recursive: true });
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('consumes a scoped authorization and applies only the final replay edits with rollback evidence', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);

    const result = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
      authorizationStore: { getAuthorization: () => ({ statusId: 'available' }) },
      replayAdapter: { replayForControlledApply: () => null },
      reviewArtifact: { fingerprint: 'attacker-supplied-value-is-ignored' },
      scopeLock: { withScopeLock: () => ({ acquired: false }) },
      scopeRemovalDryRun: { attackerSupplied: true },
      sourceWriter: { apply: () => null, prepare: () => null, restore: () => null },
    });

    expect(result).toEqual(expect.objectContaining({
      riskCount: 0,
      statusId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(result.sideEffects).toEqual(expect.objectContaining({
      applyAuditWritten: true,
      authorizationConsumed: true,
      filesDeleted: false,
      gitCommandsRun: false,
      rollbackEvidenceWritten: true,
      sourceWritten: true,
      storageChanged: false,
    }));
    const updatedSource = fs.readFileSync(context.fixture.sourcePath, 'utf8');
    expect(updatedSource).not.toContain('removes legacy alpha');
    expect(updatedSource).not.toContain('removes legacy beta');
    expect(updatedSource).toContain('keeps native behavior');
    expect(JSON.stringify(result)).not.toContain('legacy alpha marker');

    const rollbackEvidence = JSON.parse(fs.readFileSync(
      path.join(evidenceRoot, 'rollback', `${authorization.authorizationId}.json`),
      'utf8'
    ));
    expect(rollbackEvidence).toEqual(expect.objectContaining({
      authorizationId: authorization.authorizationId,
      statusId: 'prepared',
    }));
    expect(rollbackEvidence.originalSourceText).toContain('removes legacy alpha');
    expect(fs.existsSync(path.join(evidenceRoot, 'outcomes', `${authorization.authorizationId}.json`)))
      .toBe(true);
  });

  test('blocks an expired authorization before any source or rollback evidence write', async () => {
    const context = buildApplyFixture({ applyTime: EXPIRY_TIME, evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);
    const originalSource = fs.readFileSync(context.fixture.sourcePath, 'utf8');

    const result = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
      now: REVIEW_TIME,
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION
    );
    expect(result.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
          .AUTHORIZATION_EXPIRED,
      }),
    ]));
    expect(fs.readFileSync(context.fixture.sourcePath, 'utf8')).toBe(originalSource);
    expect(fs.readdirSync(path.join(evidenceRoot, 'rollback'))).toEqual([]);
  });

  test('blocks an actor mismatch and preserves the unconsumed authorization', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);

    const result = await context.applyAdapter.apply({
      actor: { id: 'other-admin', role: 'admin' },
      authorizationId: authorization.authorizationId,
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION
    );
    expect(result.risks.map(risk => risk.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
        .AUTHORIZATION_ACTOR_MISMATCH
    );
    expect((await context.authorizationStore.getAuthorization({
      authorizationId: authorization.authorizationId,
    })).statusId).toBe('available');
  });

  test('does not consume authorization when the scope lock cannot be acquired', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);
    context.applyAdapter = createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter({
      authorizationStore: context.authorizationStore,
      replayAdapter: createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
        now: REVIEW_TIME,
        preApplyChangeDetector: readyPreApplyVerification,
        repoRoot: fixtureRoot,
      }),
      repoRoot: fixtureRoot,
      scopeLock: { async withScopeLock() { return { acquired: false }; } },
      sourceWriter: createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter(),
    });

    const result = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.BLOCKED_BY_LOCK
    );
    expect((await context.authorizationStore.getAuthorization({
      authorizationId: authorization.authorizationId,
    })).statusId).toBe('available');
  });

  test('consumes authorization but blocks a final replay when source changes after authorization', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);
    fs.writeFileSync(context.fixture.sourcePath, sourceText('// source drift after authorization'));

    const result = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.BLOCKED_BY_REPLAY
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      authorizationConsumed: true,
      rollbackEvidenceWritten: false,
      sourceWritten: false,
    }));
  });

  test('restores source when durable outcome evidence fails after the bounded write', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);
    const originalSource = fs.readFileSync(context.fixture.sourcePath, 'utf8');
    const failingOutcomeStore = {
      ...context.authorizationStore,
      async recordOutcome() {
        throw new Error('simulated durable audit failure');
      },
    };
    const applyAdapter = createPolicyControlledCompatibilityNamedScopeRemovalApplyAdapter({
      authorizationStore: failingOutcomeStore,
      replayAdapter: createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
        now: REVIEW_TIME,
        preApplyChangeDetector: readyPreApplyVerification,
        repoRoot: fixtureRoot,
      }),
      now: REVIEW_TIME,
      repoRoot: fixtureRoot,
      scopeLock: acquiredScopeLock(),
      sourceWriter: createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter(),
    });

    const result = await applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
    });

    expect(result.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .ROLLED_BACK_AFTER_AUDIT_FAILURE
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      authorizationConsumed: true,
      rollbackEvidenceWritten: true,
      sourceRestored: true,
      sourceWritten: true,
    }));
    expect(fs.readFileSync(context.fixture.sourcePath, 'utf8')).toBe(originalSource);
    expect(validatePolicyControlledCompatibilityNamedScopeRemovalApply(result))
      .toEqual(expect.objectContaining({ ok: true }));
  });

  test('rejects reuse of a consumed authorization before another source write', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);
    const firstResult = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
    });
    const sourceAfterFirstApply = fs.readFileSync(context.fixture.sourcePath, 'utf8');

    const secondResult = await context.applyAdapter.apply({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
    });

    expect(firstResult.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS.APPLIED
    );
    expect(secondResult.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION
    );
    expect(secondResult.risks.map(risk => risk.riskId)).toContain(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_RISK_IDS
        .AUTHORIZATION_ALREADY_CONSUMED
    );
    expect(fs.readFileSync(context.fixture.sourcePath, 'utf8')).toBe(sourceAfterFirstApply);
  });

  test('reports a concurrent second authorization consumption as already consumed', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const authorization = await issueAuthorization(context);

    const firstConsumption = await context.authorizationStore.consumeAuthorization({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
      consumedAt: REVIEW_TIME,
    });
    const secondConsumption = await context.authorizationStore.consumeAuthorization({
      actor: ACTOR,
      authorizationId: authorization.authorizationId,
      consumedAt: REVIEW_TIME,
    });

    expect(firstConsumption.statusId).toBe('consumed');
    expect(secondConsumption.statusId).toBe('authorization_already_consumed');
  });

  test('requires rollback evidence to remain outside the repository root', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const unsafeStore = createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore({
      evidenceRoot: fixtureRoot,
      now: () => REVIEW_TIME,
      repoRoot: fixtureRoot,
    });

    await expect(unsafeStore.issueAuthorization({
      actor: ACTOR,
      expiresAt: EXPIRY_TIME,
      reviewContext: {
        executionGate: context.fixture.executionGate,
        review: context.review,
        reviewArtifact: context.reviewArtifact,
        selectedEntryIdentity: context.fixture.selectedEntryIdentity,
      },
    })).rejects.toThrow('evidence root must remain outside the repository');
  });

  test('rejects a prepared source write when the file changes after final verification', async () => {
    const context = buildApplyFixture({ evidenceRoot, fixtureRoot });
    const replayDetails = createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
      now: REVIEW_TIME,
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
    }).replayForControlledApply({
      executionGate: context.fixture.executionGate,
      review: context.review,
      reviewArtifact: context.reviewArtifact,
      selectedEntryIdentity: context.fixture.selectedEntryIdentity,
    });
    const sourceWriter = createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter();
    const prepared = await sourceWriter.prepare({
      repoRoot: fixtureRoot,
      scopeRemovalDryRun: replayDetails.freshDryRun,
    });
    fs.writeFileSync(context.fixture.sourcePath, sourceText('// changed after final preparation'));

    await expect(sourceWriter.apply(prepared)).rejects.toThrow(
      'source changed after final fingerprint verification'
    );
  });
});
