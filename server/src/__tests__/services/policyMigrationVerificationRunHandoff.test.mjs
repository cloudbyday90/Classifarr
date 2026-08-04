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
  createPolicyMigrationVerificationRunHandoff,
} from '../../services/policyMigrationVerificationRunHandoff.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  buildPolicyMigrationVerificationRunRecord,
} from '../../services/policyMigrationVerificationRunContract.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS,
} from '../../services/policyMigrationVerificationInvocationBoundary.mjs';
import {
  readyCoordinatorResult,
} from '../helpers/policyMigrationVerificationRunFixture.mjs';

function coordinatorWith(result) {
  return {
    coordinateMigrationVerification: jest.fn().mockResolvedValue(result),
  };
}

function trustedInvocation(overrides = {}) {
  return {
    proposal: { proposalFingerprint: 'a'.repeat(64) },
    acceptanceTransition: {
      transitionFingerprint: { fingerprint: 'b'.repeat(64) },
      policyContext: { policyId: 44, intentId: 101, libraryId: 6 },
    },
    now: new Date('2026-07-29T14:00:00.000Z'),
    ...overrides,
  };
}

function createHandoff(options = {}) {
  return createPolicyMigrationVerificationRunHandoff({
    invocationScopeId:
      POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER,
    ...options,
  });
}

describe('policyMigrationVerificationRunHandoff', () => {
  test('coordinates then persists only a bounded verification receipt', async () => {
    const coordinatorResult = readyCoordinatorResult();
    const record = buildPolicyMigrationVerificationRunRecord(coordinatorResult);
    const client = { query: jest.fn() };
    const db = {
      withTransaction: jest.fn(callback => callback(client)),
    };
    const claim = jest.fn().mockResolvedValue({
      claimed: true,
      replayed: false,
      verificationRun: {
        ...record,
        id: 700,
        rawSample: { title: 'must not escape receipt handoff' },
      },
    });
    const handoff = createHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED,
      ok: true,
      persisted: true,
      replayed: false,
    }));
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith({ client, coordinatorResult });
    expect(JSON.stringify(result)).not.toContain('must not persist');
    expect(JSON.stringify(result)).not.toContain('must not escape receipt handoff');
  });

  test('does not enter the persistence boundary when coordinator coverage is insufficient', async () => {
    const coordinatorResult = readyCoordinatorResult();
    coordinatorResult.statusId = 'insufficient_representative_coverage';
    coordinatorResult.verification.completed = false;
    coordinatorResult.verification.verifier = null;
    coordinatorResult.verifierReport = null;
    coordinatorResult.source.statusId = 'insufficient_representative_coverage';
    coordinatorResult.source.ready = false;
    coordinatorResult.source.summary.coverageSufficient = false;
    const db = { withTransaction: jest.fn() };
    const claim = jest.fn();
    const handoff = createHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.NOT_READY,
      ok: false,
      persisted: false,
    }));
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  test('fails closed when coordinator output is tampered with', async () => {
    const coordinatorResult = readyCoordinatorResult();
    coordinatorResult.representativeClassifications = [{ title: 'raw title' }];
    const db = { withTransaction: jest.fn() };
    const handoff = createHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim: jest.fn() },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED
    );
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('raw title');
  });

  test('requires an atomic persistence boundary and reports repository conflicts safely', async () => {
    const coordinatorResult = readyCoordinatorResult();
    const unavailableHandoff = createHandoff({
      db: {},
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim: jest.fn() },
    });

    const unavailableResult = await unavailableHandoff.recordMigrationVerificationRun(trustedInvocation());
    expect(unavailableResult.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE
    );

    const handoff = createHandoff({
      db: { withTransaction: callback => callback({}) },
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: {
        claim: jest.fn().mockResolvedValue({ conflicted: true }),
      },
    });
    const conflictResult = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(conflictResult.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED
    );
    expect(conflictResult.issues).toEqual([{ riskId: 'repository_conflict' }]);
  });

  test('fails closed when a repository claims an incomplete receipt', async () => {
    const coordinatorResult = readyCoordinatorResult();
    const handoff = createHandoff({
      db: { withTransaction: callback => callback({}) },
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: {
        claim: jest.fn().mockResolvedValue({ claimed: true, replayed: false }),
      },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED,
      ok: false,
      persisted: false,
      verificationRun: null,
    }));
  });

  test('rejects a scope mismatch before it can coordinate or persist a receipt', async () => {
    const coordinator = coordinatorWith(readyCoordinatorResult());
    const db = { withTransaction: jest.fn() };
    const claim = jest.fn();
    const handoff = createPolicyMigrationVerificationRunHandoff({
      db,
      coordinator,
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.BOUNDARY_REJECTED,
      ok: false,
      persisted: false,
      replayed: false,
      verificationRun: null,
    }));
    expect(result.issues).toEqual([{ riskId: 'invalid_invocation_scope' }]);
    expect(coordinator.coordinateMigrationVerification).not.toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  test('rejects authoring controls outside the fixed cutover invocation', async () => {
    const coordinator = coordinatorWith(readyCoordinatorResult());
    const db = { withTransaction: jest.fn() };
    const claim = jest.fn();
    const handoff = createHandoff({
      db,
      coordinator,
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation({
      routingTarget: { libraryId: 99 },
    }));

    expect(result.statusId).toBe(POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.BOUNDARY_REJECTED);
    expect(result.issues).toEqual([{ riskId: 'unexpected_invocation_field' }]);
    expect(coordinator.coordinateMigrationVerification).not.toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('routingTarget');
  });

  test.each([
    ['source audit failure', coordinatorResult => {
      coordinatorResult.source.audit = { ok: false, issueCount: 1, issues: [{ riskId: 'source_audit_failed' }] };
    }],
    ['malformed verifier fingerprint', coordinatorResult => {
      coordinatorResult.verifierReport.sampleSetFingerprint.fingerprint = 'not-a-fingerprint';
    }],
  ])('fails closed before persistence for %s', async (_name, mutateCoordinatorResult) => {
    const coordinatorResult = readyCoordinatorResult();
    mutateCoordinatorResult(coordinatorResult);
    const db = { withTransaction: jest.fn() };
    const claim = jest.fn();
    const handoff = createHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun(trustedInvocation());

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED
    );
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });
});
