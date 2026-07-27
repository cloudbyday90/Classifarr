/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'node:crypto';
import * as database from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import {
  policyProfileRefreshOutboxWorkerRepository,
} from './policyProfileRefreshOutboxWorkerRepository.mjs';
import {
  getPolicyProfileRefreshOutboxRetryDelaySeconds,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_BATCH_SIZE,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_LEASE_SECONDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_VERSION,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

const logger = createLogger('PolicyProfileRefreshOutboxWorker');

function buildResult({ claimed = 0, expired = 0 } = {}) {
  return {
    version: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_VERSION,
    claimed,
    completed: 0,
    completedWithoutProfile: 0,
    retried: 0,
    failed: expired,
    lostClaims: 0,
  };
}

class PolicyProfileRefreshOutboxWorker {
  constructor({
    dbClient = database,
    outboxRepository = policyProfileRefreshOutboxWorkerRepository,
    profileService = libraryProfileService,
    createClaimToken = randomUUID,
    loggerInstance = logger,
    batchSize = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_BATCH_SIZE,
    leaseSeconds = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_LEASE_SECONDS,
    maxAttempts = POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  } = {}) {
    this.dbClient = dbClient;
    this.outboxRepository = outboxRepository;
    this.profileService = profileService;
    this.createClaimToken = createClaimToken;
    this.logger = loggerInstance;
    this.batchSize = batchSize;
    this.leaseSeconds = leaseSeconds;
    this.maxAttempts = maxAttempts;
  }

  async claimBatch(claimToken) {
    return this.dbClient.withTransaction(async client => {
      const expired = await this.outboxRepository.closeExpiredClaims({
        client,
        maxAttempts: this.maxAttempts,
        failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.LEASE_EXPIRED,
      });
      const records = await this.outboxRepository.claimBatch({
        client,
        claimToken,
        limit: this.batchSize,
        leaseSeconds: this.leaseSeconds,
        maxAttempts: this.maxAttempts,
      });

      return { expired, records };
    });
  }

  async processClaim(record, claimToken, result) {
    try {
      const profile = await this.profileService.generateProfile(record.libraryId);
      const completed = await this.outboxRepository.completeClaim({
        client: this.dbClient,
        outboxId: record.id,
        claimToken,
      });
      if (!completed) {
        result.lostClaims += 1;
        return;
      }

      result.completed += 1;
      if (profile === null) {
        result.completedWithoutProfile += 1;
      }
    } catch {
      const failure = await this.outboxRepository.failClaim({
        client: this.dbClient,
        outboxId: record.id,
        claimToken,
        maxAttempts: this.maxAttempts,
        retryDelaySeconds: getPolicyProfileRefreshOutboxRetryDelaySeconds(record.attemptCount),
        failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.EXECUTION_FAILED,
      });
      if (!failure.updated) {
        result.lostClaims += 1;
        return;
      }

      if (failure.terminal) {
        result.failed += 1;
      } else {
        result.retried += 1;
      }
      this.logger.warn('Policy profile refresh attempt failed', {
        outboxId: record.id,
        libraryId: record.libraryId,
        attemptCount: record.attemptCount,
        terminal: failure.terminal,
        failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.EXECUTION_FAILED,
      });
    }
  }

  async run() {
    const claimToken = this.createClaimToken();
    const { expired, records } = await this.claimBatch(claimToken);
    const result = buildResult({ claimed: records.length, expired });

    for (const record of records) {
      await this.processClaim(record, claimToken, result);
    }

    this.logger.info('Policy profile refresh outbox worker completed', result);
    return result;
  }
}

const policyProfileRefreshOutboxWorker = new PolicyProfileRefreshOutboxWorker();

export {
  buildResult,
  PolicyProfileRefreshOutboxWorker,
  policyProfileRefreshOutboxWorker,
};
