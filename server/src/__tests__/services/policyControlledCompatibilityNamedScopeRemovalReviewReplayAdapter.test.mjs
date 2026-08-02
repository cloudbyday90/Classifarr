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
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalAdapter.mjs';
import {
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalReviewArtifact.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay,
  createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter,
  validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  REVIEW_TIME,
  buildReadyGate,
  buildScopeRemovalReviewFixture,
  namedScopeEntry,
  readyPreApplyVerification,
  reviewMetadata,
  sourceText,
} from './fixtures/policyControlledCompatibilityNamedScopeRemovalReviewFixtures.mjs';

function buildReplayInput({ fixture, review, reviewArtifact, now = REVIEW_TIME } = {}) {
  return {
    executionGate: fixture.executionGate,
    now,
    preApplyChangeDetector: readyPreApplyVerification,
    repoRoot: fixture.repoRoot,
    review,
    reviewArtifact,
    selectedEntryIdentity: fixture.selectedEntryIdentity,
  };
}

describe('policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-named-scope-replay-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('accepts only a fresh server-derived replay that matches the reviewed scope snapshot', () => {
    const fixture = buildScopeRemovalReviewFixture({
      fixtureRoot,
      source: sourceText('// replay-secret-must-not-be-output'),
    });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun: fixture.scopeRemovalDryRun,
    });
    const adapter = createPolicyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter({
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
    });

    const replay = adapter.replay({
      executionGate: fixture.executionGate,
      now: REVIEW_TIME,
      review,
      reviewArtifact,
      selectedEntryIdentity: fixture.selectedEntryIdentity,
    });

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .READY_FOR_FUTURE_REMOVAL_ADMISSION
    );
    expect(replay).toEqual(expect.objectContaining({
      readyForFutureRemovalAdmission: true,
      riskCount: 0,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(replay.freshDryRun).toEqual(expect.objectContaining({
      scopeIdentity: fixture.selectedEntryIdentity,
      sourceFingerprint: fixture.scopeRemovalDryRun.source.fingerprint,
      validationOk: true,
    }));
    expect(replay.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      sourceWritten: false,
      storageChanged: false,
    }));
    expect(JSON.stringify(replay)).not.toContain('replay-secret-must-not-be-output');

    const alteredReplay = structuredClone(replay);
    alteredReplay.statusId =
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_REVIEW_ARTIFACT;
    alteredReplay.sideEffects.sourceWritten = true;
    expect(validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay(alteredReplay))
      .toEqual(expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            riskId:
              POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
                .STATUS_MISMATCH,
          }),
          expect.objectContaining({
            riskId:
              POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
                .SIDE_EFFECT_PERFORMED,
          }),
        ]),
      }));
  });

  test('rejects a caller-supplied dry-run object without invoking a source replay', () => {
    let replayAttempted = false;

    const replay = buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay({
      preApplyChangeDetector: () => {
        replayAttempted = true;
        throw new Error('caller-supplied snapshots must short-circuit before source access');
      },
      scopeRemovalDryRun: { readyForScopeRemovalReview: true },
    });

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_CALLER_INPUT
    );
    expect(replay.freshDryRun).toBeNull();
    expect(replay.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
            .CALLER_SUPPLIED_DRY_RUN,
      }),
    ]));
    expect(replayAttempted).toBe(false);
  });

  test('rejects source drift between review and replay', () => {
    const fixture = buildScopeRemovalReviewFixture({ fixtureRoot });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun: fixture.scopeRemovalDryRun,
    });
    fs.writeFileSync(fixture.sourcePath, sourceText('// source changed after review'));

    const replay = buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay(
      buildReplayInput({ fixture, review, reviewArtifact })
    );

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_REVIEW_ARTIFACT
    );
    expect(replay.reviewValidation).toEqual(expect.objectContaining({ ok: false }));
    expect(replay.freshDryRun.sourceFingerprint).not.toBe(
      fixture.scopeRemovalDryRun.source.fingerprint
    );
  });

  test('rejects stale execution-gate evidence before accepting an artifact', () => {
    const fixture = buildScopeRemovalReviewFixture({ fixtureRoot });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun: fixture.scopeRemovalDryRun,
    });

    const replay = buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay(
      buildReplayInput({
        fixture,
        now: '2026-07-14T20:20:01.000Z',
        review,
        reviewArtifact,
      })
    );

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_FRESH_DRY_RUN
    );
    expect(replay.reviewValidation).toBeNull();
    expect(replay.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_RISK_IDS
            .FRESH_DRY_RUN_NOT_READY,
      }),
    ]));
  });

  test('rejects review metadata drift even when the source snapshot is unchanged', () => {
    const fixture = buildScopeRemovalReviewFixture({ fixtureRoot });
    const originalReview = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review: originalReview,
      scopeRemovalDryRun: fixture.scopeRemovalDryRun,
    });

    const replay = buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay(
      buildReplayInput({
        fixture,
        review: reviewMetadata({ reviewReason: 'Changed after the original review.' }),
        reviewArtifact,
      })
    );

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_REVIEW_ARTIFACT
    );
    expect(replay.reviewValidation).toEqual(expect.objectContaining({ ok: false }));
  });

  test('rejects a duplicate selected named-scope identity during the fresh dry run', () => {
    const entry = namedScopeEntry();
    const duplicateGate = buildReadyGate(entry, {
      manifestEntries: [entry, structuredClone(entry)],
    });
    const fixture = buildScopeRemovalReviewFixture({
      entry,
      executionGate: duplicateGate,
      fixtureRoot,
    });

    const replay = buildPolicyControlledCompatibilityNamedScopeRemovalReviewReplay({
      executionGate: fixture.executionGate,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
      review: reviewMetadata(),
      reviewArtifact: null,
      selectedEntryIdentity: fixture.selectedEntryIdentity,
    });

    expect(replay.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_REPLAY_ADAPTER_STATUS_IDS
        .BLOCKED_BY_FRESH_DRY_RUN
    );
    expect(replay.freshDryRun.riskIds).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_IDENTITY_AMBIGUOUS,
    ]));
    expect(validatePolicyControlledCompatibilityNamedScopeRemovalReviewReplay(replay))
      .toEqual(expect.objectContaining({ ok: true }));
  });
});
