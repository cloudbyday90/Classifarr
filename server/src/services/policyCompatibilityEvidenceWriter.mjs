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
  buildPolicyCompatibilityEvidenceRecord,
} from './policyCompatibilityEvidenceRecord.mjs';
import {
  policyCompatibilityEvidenceRepository,
} from './policyCompatibilityEvidenceRepository.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';

class PolicyCompatibilityEvidenceWriter {
  constructor({
    buildRecord = buildPolicyCompatibilityEvidenceRecord,
    repository = policyCompatibilityEvidenceRepository,
  } = {}) {
    this.buildRecord = buildRecord;
    this.repository = repository;
  }

  async write({
    client,
    command = {},
    executionState = {},
  } = {}) {
    const recordResult = this.buildRecord({ command, executionState });
    if (recordResult.ready !== true) {
      throw new TypeError(
        `Compatibility evidence persistence was not authorized: ${recordResult.reasonCodes.join(', ')}`,
      );
    }

    const evidence = await this.repository.upsert({
      client,
      record: recordResult.record,
    });
    if (!evidence.id) {
      throw new Error('Authorized compatibility evidence was not persisted.');
    }

    return {
      operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS
        .WRITE_COMPATIBILITY_EVIDENCE,
      persisted: true,
      reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS
        .COMPATIBILITY_EVIDENCE_PERSISTED,
      evidence: {
        id: evidence.id,
        scope: evidence.scope,
        libraryId: evidence.libraryId,
        evidenceKey: evidence.evidenceKey,
        usageCount: evidence.usageCount,
      },
    };
  }
}

const policyCompatibilityEvidenceWriter = new PolicyCompatibilityEvidenceWriter();

async function writePolicyAuthorizedCompatibilityEvidence(input = {}) {
  return policyCompatibilityEvidenceWriter.write(input);
}

export {
  PolicyCompatibilityEvidenceWriter,
  policyCompatibilityEvidenceWriter,
  writePolicyAuthorizedCompatibilityEvidence,
};
