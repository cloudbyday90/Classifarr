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
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  writePolicyAuthorizedCompatibilityEvidence,
} from './policyCompatibilityEvidenceWriter.mjs';
import {
  writePolicyAuthorizedIdentityEvidence,
} from './policyIdentityEvidenceAuthorityWriter.mjs';
import {
  buildPolicyProfileRefreshCommand,
} from './policyProfileRefreshCommand.mjs';
import {
  buildPolicyProfileRefreshOutboxRecord,
} from './policyProfileRefreshOutboxRecord.mjs';
import {
  policyProfileRefreshOutboxRepository,
} from './policyProfileRefreshOutboxRepository.mjs';

function selectEvidenceWriter({ operationId, writeCompatibilityEvidence, writeIdentityEvidence }) {
  if (operationId ===
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE) {
    return writeCompatibilityEvidence;
  }
  if (operationId ===
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE) {
    return writeIdentityEvidence;
  }

  return null;
}

class PolicyRefreshBackedEvidencePersistence {
  constructor({
    buildRefreshCommand = buildPolicyProfileRefreshCommand,
    buildOutboxRecord = buildPolicyProfileRefreshOutboxRecord,
    writeCompatibilityEvidence = writePolicyAuthorizedCompatibilityEvidence,
    writeIdentityEvidence = writePolicyAuthorizedIdentityEvidence,
    outboxRepository = policyProfileRefreshOutboxRepository,
  } = {}) {
    this.buildRefreshCommand = buildRefreshCommand;
    this.buildOutboxRecord = buildOutboxRecord;
    this.writeCompatibilityEvidence = writeCompatibilityEvidence;
    this.writeIdentityEvidence = writeIdentityEvidence;
    this.outboxRepository = outboxRepository;
  }

  async persist({ client, command = {}, executionState = {} } = {}) {
    if (!client || typeof client.query !== 'function') {
      throw new TypeError('Refresh-backed evidence persistence requires a transaction client.');
    }

    const refreshCommand = this.buildRefreshCommand(command);
    const outboxRecord = this.buildOutboxRecord(refreshCommand);
    if (outboxRecord.ready !== true) {
      throw new TypeError(
        `Profile refresh outbox was not authorized: ${outboxRecord.reasonCodes.join(', ')}`,
      );
    }

    const evidenceWriter = selectEvidenceWriter({
      operationId: outboxRecord.record.learningOperationId,
      writeCompatibilityEvidence: this.writeCompatibilityEvidence,
      writeIdentityEvidence: this.writeIdentityEvidence,
    });
    if (!evidenceWriter) {
      throw new TypeError('Profile refresh outbox requires an admitted evidence writer.');
    }

    // Both writes deliberately use the caller's transaction. A failed evidence
    // write therefore cannot leave a refresh row that describes no evidence.
    const learning = await evidenceWriter({ client, command, executionState });
    if (learning?.operationId !== outboxRecord.record.learningOperationId ||
        (learning?.persisted !== true && learning?.replayed !== true)) {
      throw new Error('Admitted evidence mutation did not report a persisted matching operation.');
    }

    const persisted = await this.outboxRepository.enqueue({
      client,
      record: outboxRecord.record,
    });
    if (!persisted.outbox?.id) {
      throw new Error('Authorized profile refresh outbox record was not persisted.');
    }

    return {
      learning,
      profileRefresh: {
        operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.QUEUE_PROFILE_REFRESH,
        persisted: persisted.replayed !== true,
        replayed: persisted.replayed === true,
        reasonId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS
          .PROFILE_REFRESH_OUTBOX_PERSISTED,
        outbox: persisted.outbox,
      },
    };
  }
}

const policyRefreshBackedEvidencePersistence = new PolicyRefreshBackedEvidencePersistence();

async function persistPolicyRefreshBackedEvidence(input = {}) {
  return policyRefreshBackedEvidencePersistence.persist(input);
}

export {
  PolicyRefreshBackedEvidencePersistence,
  persistPolicyRefreshBackedEvidence,
  policyRefreshBackedEvidencePersistence,
  selectEvidenceWriter,
};
