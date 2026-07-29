/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyConversionActorSources.mjs';
import {
  buildPolicyLibraryRebuildAcceptanceTransition,
} from '../../services/policyLibraryRebuildAcceptanceTransition.mjs';
import {
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  createPolicyMigrationRepresentativeClassificationSource,
} from '../../services/policyMigrationRepresentativeClassificationSource.mjs';
import {
  createPolicyMigrationVerificationCoordinator,
} from '../../services/policyMigrationVerificationCoordinator.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS,
  buildPolicyMigrationVerificationCoordinatorAudit,
} from '../../services/policyMigrationVerificationCoordinatorContract.mjs';
import {
  buildPolicyRollbackSnapshotWindow,
} from '../../services/policyRollbackSnapshotWindow.mjs';

const NOW = '2026-07-29T12:00:00.000Z';

function profileHandoff() {
  return {
    version: 'policy.library_profile_evidence_loader.v1',
    ok: true,
    statusId: 'ready',
    libraryId: 6,
    profileEvidence: {
      version: 'policy.library_profile_evidence.v1',
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          value: '80%',
          count: 8,
          confidence: 0.8,
          reasonCode: 'observed_library_distribution',
        }],
        outliers: [],
      },
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    },
    profileEvidenceAudit: { ok: true },
    profileFreshness: {
      stale: false,
      updatedAt: NOW,
      reasonCode: 'current_profile_timestamp',
    },
    evidenceBoundary: { ok: true },
    evidenceBoundaryAudit: { ok: true },
    sideEffects: {
      libraryProfileRead: true,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: true,
      policyStorageMutated: false,
    },
  };
}

function proposal() {
  return buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileHandoff(),
    operatorIntent: {
      belongsHere: [{
        key: 'studio:disney',
        label: 'Disney',
        count: 7,
      }],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
  });
}

function policyContext() {
  return {
    policyId: 44,
    intentId: 101,
    libraryId: 6,
  };
}

function rollbackWindowPlan() {
  return buildPolicyRollbackSnapshotWindow({
    policy: {
      id: 44,
      intent_id: 101,
      library_id: 6,
      customSignals: {
        genres: { require_any: ['Animation'] },
      },
    },
    action: {
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      actorId: 'admin:1',
      reasonCode: 'library_rebuild',
      reason: 'Operator accepted a library rebuild proposal.',
    },
    now: NOW,
  });
}

function acceptanceTransition(rebuildProposal, { accepted = true } = {}) {
  return buildPolicyLibraryRebuildAcceptanceTransition({
    proposal: rebuildProposal,
    policyContext: policyContext(),
    rollbackWindowPlan: rollbackWindowPlan(),
    operatorDecision: accepted
      ? {
          actorId: 'admin:1',
          actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
          decisionId: 'accept_rebuild',
        }
      : null,
    now: NOW,
  });
}

function persistedPolicyContext() {
  return {
    policy_id: 44,
    library_id: 6,
    library_name: 'Animated Movies',
    media_type: 'movie',
    library_active: true,
  };
}

function createSource({ classifications = [] } = {}) {
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [persistedPolicyContext()] })
      .mockResolvedValueOnce({ rows: classifications }),
  };
  const source = createPolicyMigrationRepresentativeClassificationSource({ db });

  return { db, source };
}

function createFixture({ classifications = [] } = {}) {
  const rebuildProposal = proposal();
  const transition = acceptanceTransition(rebuildProposal);
  const sourceFixture = createSource({ classifications });

  return {
    proposal: rebuildProposal,
    acceptanceTransition: transition,
    ...sourceFixture,
  };
}

describe('policyMigrationVerificationCoordinator', () => {
  test('coordinates an accepted rebuild through persisted samples and a validated verifier report', async () => {
    const fixture = createFixture({
      classifications: [{
        id: 10674,
        media_type: 'movie',
        library_id: 6,
        status: 'routed',
        confidence: 0.8,
        title: 'Raw title must not escape',
        metadata: { providerPayload: 'must not escape' },
      }],
    });
    const collectRepresentativeClassifications = jest.fn(arguments_ =>
      fixture.source.collectRepresentativeClassifications(arguments_)
    );
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: { collectRepresentativeClassifications },
    });

    const result = await coordinator.coordinateMigrationVerification({
      proposal: fixture.proposal,
      acceptanceTransition: fixture.acceptanceTransition,
      maxClassifications: 2,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY,
      policyContext: policyContext(),
      source: expect.objectContaining({
        statusId: 'ready',
        ready: true,
        summary: expect.objectContaining({
          representativeClassificationCount: 1,
          coverageSufficient: true,
        }),
        provenance: expect.objectContaining({
          policyId: 44,
          libraryId: 6,
          deterministicOrderId: 'created_at_desc_id_desc',
        }),
      }),
      verification: expect.objectContaining({
        completed: true,
        canApplyReplacement: false,
        canDeleteLegacyPaths: false,
        verifier: expect.objectContaining({
          statusId: 'review_required',
          audit: expect.objectContaining({ ok: true }),
        }),
      }),
      sideEffects: {
        databaseRead: true,
        policyStorageMutated: false,
        classificationStorageMutated: false,
        routingWritten: false,
        rollbackCreated: false,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
      },
    }));
    expect(collectRepresentativeClassifications).toHaveBeenCalledWith({
      policyContext: {
        policyId: 44,
        libraryId: 6,
      },
      proposal: fixture.proposal,
      maxClassifications: 2,
    });
    expect(result).not.toHaveProperty('representativeClassifications');
    expect(result.source).not.toHaveProperty('representativeClassifications');
    expect(JSON.stringify(result)).not.toContain('Raw title must not escape');
    expect(JSON.stringify(result)).not.toContain('must not escape');
    expect(buildPolicyMigrationVerificationCoordinatorAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('stops after a valid insufficient-coverage source result without calling the verifier', async () => {
    const fixture = createFixture();
    const buildVerifierReport = jest.fn();
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: fixture.source,
      buildVerifierReport,
    });

    const result = await coordinator.coordinateMigrationVerification({
      proposal: fixture.proposal,
      acceptanceTransition: fixture.acceptanceTransition,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE,
      verification: expect.objectContaining({
        completed: false,
        verifier: null,
      }),
      verifierReport: null,
    }));
    expect(buildVerifierReport).not.toHaveBeenCalled();
    expect(buildPolicyMigrationVerificationCoordinatorAudit(result).ok).toBe(true);
  });

  test('rejects an unaccepted transition before source collection', async () => {
    const rebuildProposal = proposal();
    const unacceptedTransition = acceptanceTransition(rebuildProposal, { accepted: false });
    const collectRepresentativeClassifications = jest.fn();
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: { collectRepresentativeClassifications },
    });

    const result = await coordinator.coordinateMigrationVerification({
      proposal: rebuildProposal,
      acceptanceTransition: unacceptedTransition,
      now: NOW,
    });

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.INVALID_ACCEPTANCE_TRANSITION
    );
    expect(result.ok).toBe(false);
    expect(collectRepresentativeClassifications).not.toHaveBeenCalled();
    expect(buildPolicyMigrationVerificationCoordinatorAudit(result).ok).toBe(true);
  });

  test('stops when source auditing rejects an otherwise readable source result', async () => {
    const fixture = createFixture({
      classifications: [{
        id: 10674,
        media_type: 'movie',
        library_id: 6,
        status: 'routed',
        confidence: 0.8,
      }],
    });
    const buildVerifierReport = jest.fn();
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: {
        async collectRepresentativeClassifications(input) {
          const result = await fixture.source.collectRepresentativeClassifications(input);
          result.sideEffects.policyStorageMutated = true;
          return result;
        },
      },
      buildVerifierReport,
    });

    const result = await coordinator.coordinateMigrationVerification({
      proposal: fixture.proposal,
      acceptanceTransition: fixture.acceptanceTransition,
      now: NOW,
    });

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_AUDIT_FAILED
    );
    expect(result.verifierReport).toBeNull();
    expect(buildVerifierReport).not.toHaveBeenCalled();
    expect(buildPolicyMigrationVerificationCoordinatorAudit(result).ok).toBe(true);
  });

  test('suppresses an invalid verifier result and returns a safe failed status', async () => {
    const fixture = createFixture({
      classifications: [{
        id: 10674,
        media_type: 'movie',
        library_id: 6,
        status: 'routed',
        confidence: 0.8,
      }],
    });
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: fixture.source,
      buildVerifierReport: jest.fn(() => ({ version: 'unsafe' })),
    });

    const result = await coordinator.coordinateMigrationVerification({
      proposal: fixture.proposal,
      acceptanceTransition: fixture.acceptanceTransition,
      now: NOW,
    });

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.VERIFIER_AUDIT_FAILED
    );
    expect(result.ok).toBe(false);
    expect(result.verifierReport).toBeNull();
    expect(buildPolicyMigrationVerificationCoordinatorAudit(result).ok).toBe(true);
  });

  test('sanitizes unexpected source failures and detects output tampering', async () => {
    const fixture = createFixture();
    const coordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: {
        collectRepresentativeClassifications: jest.fn().mockRejectedValue(
          new Error('database detail must not escape')
        ),
      },
    });

    const failedResult = await coordinator.coordinateMigrationVerification({
      proposal: fixture.proposal,
      acceptanceTransition: fixture.acceptanceTransition,
      now: NOW,
    });

    expect(failedResult.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.COORDINATION_FAILED
    );
    expect(JSON.stringify(failedResult)).not.toContain('database detail must not escape');

    const validFixture = createFixture({
      classifications: [{
        id: 10674,
        media_type: 'movie',
        library_id: 6,
        status: 'routed',
        confidence: 0.8,
      }],
    });
    const validCoordinator = createPolicyMigrationVerificationCoordinator({
      representativeClassificationSource: validFixture.source,
    });
    const validResult = await validCoordinator.coordinateMigrationVerification({
      proposal: validFixture.proposal,
      acceptanceTransition: validFixture.acceptanceTransition,
      now: NOW,
    });
    validResult.representativeClassifications = [];
    validResult.verification.canApplyReplacement = true;
    validResult.sideEffects.routingWritten = true;
    delete validResult.sideEffects.providerQuotaRead;

    const audit = buildPolicyMigrationVerificationCoordinatorAudit(validResult);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SAMPLE_OUTPUT_EXPOSED,
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SIDE_EFFECT_PERFORMED,
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.MISSING_SAFETY_DECLARATION,
    ]));
  });
});
