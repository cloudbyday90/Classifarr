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
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
  buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
  validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalReviewArtifact.mjs';
import {
  REVIEW_TIME,
  buildReadyScopeRemovalDryRun,
  reviewMetadata,
} from './fixtures/policyControlledCompatibilityNamedScopeRemovalReviewFixtures.mjs';

describe('policyControlledCompatibilityNamedScopeRemovalReviewArtifact', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-named-scope-review-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('binds a fresh accepted dry run, source snapshot, exact edits, and reviewer context', () => {
    const scopeRemovalDryRun = buildReadyScopeRemovalDryRun({
      fixtureRoot,
      suffix: '// review-secret',
    });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun,
    });

    expect(reviewArtifact.version)
      .toBe(POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION);
    expect(reviewArtifact.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(reviewArtifact.provenance).toEqual(expect.objectContaining({
      editCount: 2,
      reviewMetadataFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      scopeIdentity: scopeRemovalDryRun.selectedScope.entryIdentity,
      scopeSnapshotFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sourceFingerprint: scopeRemovalDryRun.source.fingerprint,
      resultFingerprint: scopeRemovalDryRun.dryRun.resultFingerprint,
    }));
    expect(JSON.stringify(reviewArtifact)).not.toContain('review-secret');
    expect(validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      now: REVIEW_TIME,
      review,
      reviewArtifact,
      scopeRemovalDryRun,
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  test('rejects artifact substitution and changes to the reviewed source snapshot', () => {
    const firstDryRun = buildReadyScopeRemovalDryRun({
      fixtureRoot,
      suffix: '// first source snapshot',
    });
    const review = reviewMetadata();
    const firstArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun: firstDryRun,
    });
    const secondDryRun = buildReadyScopeRemovalDryRun({
      fixtureRoot,
      suffix: '// second source snapshot',
    });

    const validation = validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      now: REVIEW_TIME,
      review,
      reviewArtifact: firstArtifact,
      scopeRemovalDryRun: secondDryRun,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_PROVENANCE_MISMATCH,
    ]));
  });

  test('rejects altered edit ranges and hashes after an artifact has been reviewed', () => {
    const scopeRemovalDryRun = buildReadyScopeRemovalDryRun({ fixtureRoot });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun,
    });
    const alteredDryRun = structuredClone(scopeRemovalDryRun);
    alteredDryRun.dryRun.edits[0].endOffset += 1;
    alteredDryRun.dryRun.edits[0].expectedTextFingerprint = 'a'.repeat(64);

    const validation = validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      now: REVIEW_TIME,
      review,
      reviewArtifact,
      scopeRemovalDryRun: alteredDryRun,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
    ]));
  });

  test('rejects stale dry-run source snapshots and duplicate named-scope members', () => {
    const scopeRemovalDryRun = buildReadyScopeRemovalDryRun({ fixtureRoot });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun,
    });
    const duplicateScopeDryRun = structuredClone(scopeRemovalDryRun);
    duplicateScopeDryRun.selectedScope.testNameFragments.push(
      duplicateScopeDryRun.selectedScope.testNameFragments[0]
    );

    const validation = validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      maxDryRunAgeMs: 5 * 60 * 1000,
      now: '2026-07-14T20:10:01.000Z',
      review,
      reviewArtifact,
      scopeRemovalDryRun: duplicateScopeDryRun,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .DUPLICATE_SCOPE_IDENTITY,
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .STALE_SCOPE_REMOVAL_DRY_RUN,
    ]));
  });

  test('rejects a reviewed dry run whose gate, observations, or side-effect boundary changes', () => {
    const scopeRemovalDryRun = buildReadyScopeRemovalDryRun({ fixtureRoot });
    const review = reviewMetadata();
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun,
    });
    const alteredDryRun = structuredClone(scopeRemovalDryRun);
    alteredDryRun.executionGate.originalStatusId = 'blocked_by_worktree';
    alteredDryRun.preflight.beforeSourceRead.statusId = 'blocked';
    alteredDryRun.source.sourceFragmentObservations[0].occurrenceCount = 0;
    alteredDryRun.sideEffects.sourceWritten = true;

    const validation = validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      now: REVIEW_TIME,
      review,
      reviewArtifact,
      scopeRemovalDryRun: alteredDryRun,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .SCOPE_REMOVAL_DRY_RUN_INVALID,
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .REVIEW_ARTIFACT_MISMATCH,
    ]));
  });

  test('rejects review artifacts without a complete reviewer context', () => {
    const scopeRemovalDryRun = buildReadyScopeRemovalDryRun({ fixtureRoot });
    const review = reviewMetadata({ reviewReason: '', reviewedBy: '' });
    const reviewArtifact = buildPolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      review,
      scopeRemovalDryRun,
    });

    const validation = validatePolicyControlledCompatibilityNamedScopeRemovalReviewArtifact({
      now: REVIEW_TIME,
      review,
      reviewArtifact,
      scopeRemovalDryRun,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS
        .MISSING_REVIEWER_CONTEXT,
    ]));
  });
});
