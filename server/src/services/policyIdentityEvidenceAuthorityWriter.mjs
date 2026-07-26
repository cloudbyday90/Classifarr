/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyIdentityEvidenceAdmissionContext,
  buildPolicyIdentityEvidenceAdmissionRecord,
} from './policyIdentityEvidenceAdmissionRecord.mjs';
import {
  policyIdentityEvidenceAdmissionRepository,
} from './policyIdentityEvidenceAdmissionRepository.mjs';
import {
  policyIdentityEvidenceAuthorityResolver,
} from './policyIdentityEvidenceAuthorityResolver.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';

class PolicyIdentityEvidenceAuthorityWriter {
  constructor({
    buildContext = buildPolicyIdentityEvidenceAdmissionContext,
    buildRecord = buildPolicyIdentityEvidenceAdmissionRecord,
    authorityResolver = policyIdentityEvidenceAuthorityResolver,
    repository = policyIdentityEvidenceAdmissionRepository,
  } = {}) {
    this.buildContext = buildContext;
    this.buildRecord = buildRecord;
    this.authorityResolver = authorityResolver;
    this.repository = repository;
  }

  async write({ client, command = {}, executionState = {} } = {}) {
    const contextResult = this.buildContext({ command, executionState });
    if (contextResult.ready !== true) {
      throw new TypeError(
        `Identity evidence admission was not authorized: ${contextResult.reasonCodes.join(', ')}`,
      );
    }

    const authorityResult = await this.authorityResolver.resolve({
      client,
      libraryId: contextResult.context.libraryId,
      candidate: contextResult.context.candidate,
      executionState,
    });
    const recordResult = this.buildRecord({
      context: contextResult.context,
      authorityResult,
    });
    if (recordResult.ready !== true) {
      throw new TypeError(
        `Identity evidence admission was not authorized: ${recordResult.reasonCodes.join(', ')}`,
      );
    }

    const persisted = await this.repository.upsert({
      client,
      record: recordResult.record,
    });
    if (!persisted.admission?.id) {
      throw new Error('Authorized identity evidence admission was not persisted.');
    }

    return {
      operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS
        .WRITE_IDENTITY_EVIDENCE,
      persisted: persisted.replayed !== true,
      replayed: persisted.replayed === true,
      reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS
        .IDENTITY_EVIDENCE_ADMISSION_PERSISTED,
      admission: persisted.admission,
    };
  }
}

const policyIdentityEvidenceAuthorityWriter = new PolicyIdentityEvidenceAuthorityWriter();

async function writePolicyAuthorizedIdentityEvidence(input = {}) {
  return policyIdentityEvidenceAuthorityWriter.write(input);
}

export {
  PolicyIdentityEvidenceAuthorityWriter,
  policyIdentityEvidenceAuthorityWriter,
  writePolicyAuthorizedIdentityEvidence,
};
