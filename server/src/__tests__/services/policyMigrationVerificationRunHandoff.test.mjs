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
  readyCoordinatorResult,
} from '../helpers/policyMigrationVerificationRunFixture.mjs';

function coordinatorWith(result) {
  return {
    coordinateMigrationVerification: jest.fn().mockResolvedValue(result),
  };
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
    const handoff = createPolicyMigrationVerificationRunHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun({ maxClassifications: 25 });

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
    const handoff = createPolicyMigrationVerificationRunHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim },
    });

    const result = await handoff.recordMigrationVerificationRun();

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
    const handoff = createPolicyMigrationVerificationRunHandoff({
      db,
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim: jest.fn() },
    });

    const result = await handoff.recordMigrationVerificationRun();

    expect(result.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.COORDINATOR_AUDIT_FAILED
    );
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('raw title');
  });

  test('requires an atomic persistence boundary and reports repository conflicts safely', async () => {
    const coordinatorResult = readyCoordinatorResult();
    const unavailableHandoff = createPolicyMigrationVerificationRunHandoff({
      db: {},
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: { claim: jest.fn() },
    });

    const unavailableResult = await unavailableHandoff.recordMigrationVerificationRun();
    expect(unavailableResult.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_BOUNDARY_UNAVAILABLE
    );

    const handoff = createPolicyMigrationVerificationRunHandoff({
      db: { withTransaction: callback => callback({}) },
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: {
        claim: jest.fn().mockResolvedValue({ conflicted: true }),
      },
    });
    const conflictResult = await handoff.recordMigrationVerificationRun();

    expect(conflictResult.statusId).toBe(
      POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED
    );
    expect(conflictResult.issues).toEqual([{ riskId: 'repository_conflict' }]);
  });

  test('fails closed when a repository claims an incomplete receipt', async () => {
    const coordinatorResult = readyCoordinatorResult();
    const handoff = createPolicyMigrationVerificationRunHandoff({
      db: { withTransaction: callback => callback({}) },
      coordinator: coordinatorWith(coordinatorResult),
      verificationRunRepository: {
        claim: jest.fn().mockResolvedValue({ claimed: true, replayed: false }),
      },
    });

    const result = await handoff.recordMigrationVerificationRun();

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTENCE_FAILED,
      ok: false,
      persisted: false,
      verificationRun: null,
    }));
  });
});
