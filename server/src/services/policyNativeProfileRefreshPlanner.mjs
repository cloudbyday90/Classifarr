/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as database from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  policyNativeProfileRefreshCandidateRepository,
} from './policyNativeProfileRefreshCandidateRepository.mjs';
import {
  buildPolicyNativeProfileRefreshRequest,
} from './policyNativeProfileRefreshRequest.mjs';
import {
  policyNativeProfileRefreshFailureRepository,
} from './policyNativeProfileRefreshFailureRepository.mjs';
import {
  buildPolicyNativeProfileRefreshSuccessor,
} from './policyNativeProfileRefreshSuccessor.mjs';
import {
  evaluatePolicyNativeProfileRefreshTerminalFailure,
} from './policyProfileRefreshFailureClassification.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';
import {
  enqueuePolicyProfileRefresh,
} from './policyProfileRefreshOutboxRepository.mjs';

const POLICY_NATIVE_PROFILE_REFRESH_PLANNER_VERSION =
  'policy.native_profile_refresh_planner.v1';

const logger = createLogger('PolicyNativeProfileRefreshPlanner');

function buildResult({
  scanned = 0,
  eligible = 0,
  queued = 0,
  replayed = 0,
  coalesced = 0,
  invalid = 0,
  successorQueued = 0,
  successorReplayed = 0,
  successorCoalesced = 0,
  successorInvalid = 0,
  successorBlocked = 0,
} = {}) {
  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_PLANNER_VERSION,
    statusId: 'completed',
    scanned,
    eligible,
    queued,
    replayed,
    coalesced,
    invalid,
    successorQueued,
    successorReplayed,
    successorCoalesced,
    successorInvalid,
    successorBlocked,
  };
}

class PolicyNativeProfileRefreshPlanner {
  constructor({
    dbClient = database,
    candidateRepository = policyNativeProfileRefreshCandidateRepository,
    buildRequest = buildPolicyNativeProfileRefreshRequest,
    failureRepository = policyNativeProfileRefreshFailureRepository,
    buildSuccessor = buildPolicyNativeProfileRefreshSuccessor,
    evaluateTerminalFailure = evaluatePolicyNativeProfileRefreshTerminalFailure,
    enqueue = enqueuePolicyProfileRefresh,
    now = () => new Date(),
    loggerInstance = logger,
  } = {}) {
    this.dbClient = dbClient;
    this.candidateRepository = candidateRepository;
    this.buildRequest = buildRequest;
    this.failureRepository = failureRepository;
    this.buildSuccessor = buildSuccessor;
    this.evaluateTerminalFailure = evaluateTerminalFailure;
    this.enqueue = enqueue;
    this.now = now;
    this.logger = loggerInstance;
  }

  async persistRequests(requests) {
    if (requests.length === 0) return [];

    if (typeof this.dbClient?.withTransaction !== 'function') {
      throw new TypeError('Native profile refresh planning requires transactional persistence.');
    }

    return this.dbClient.withTransaction(async client => {
      const results = [];
      for (const request of requests) {
        const primary = await this.enqueue({ client, record: request.record });
        let successor = null;

        if (primary?.outbox?.processingState === POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED) {
          const failureHistory = await this.failureRepository.findHistory({
            client,
            libraryId: request.record.libraryId,
            sourceEventId: request.record.sourceEventId,
          });
          if (!failureHistory) {
            successor = { invalid: true };
          } else {
            const terminalFailure = this.evaluateTerminalFailure({
              failureCode: failureHistory.failureCode,
            });
            if (terminalFailure.scheduleSuccessor !== true) {
              successor = { blocked: true, reasonCodes: terminalFailure.reasonCodes };
            } else {
              const successorRequest = this.buildSuccessor({
                record: request.record,
                failedOutboxId: failureHistory.failedOutboxId,
                failureCount: failureHistory.failureCount,
                now: this.now(),
              });

              if (successorRequest.ready === true) {
                successor = await this.enqueue({ client, record: successorRequest.record });
              } else {
                successor = { invalid: true };
              }
            }
          }
        }

        results.push({ primary, successor });
      }
      return results;
    });
  }

  async run() {
    const candidates = await this.candidateRepository.findCandidates({ client: this.dbClient });
    const requests = candidates.map(candidate => ({
      candidate,
      request: this.buildRequest(candidate),
    }));
    const readyRequests = requests.filter(({ request }) => request.ready === true);
    const persisted = await this.persistRequests(readyRequests.map(({ request }) => request));
    const result = buildResult({
      scanned: candidates.length,
      eligible: readyRequests.length,
      queued: persisted.filter(entry =>
        entry.primary.replayed !== true && entry.primary.coalesced !== true
      ).length,
      replayed: persisted.filter(entry => entry.primary.replayed === true).length,
      coalesced: persisted.filter(entry => entry.primary.coalesced === true).length,
      invalid: requests.filter(({ request }) => request.ready !== true).length,
      successorQueued: persisted.filter(entry =>
        entry.successor &&
        entry.successor.invalid !== true &&
        entry.successor.blocked !== true &&
        entry.successor.replayed !== true &&
        entry.successor.coalesced !== true
      ).length,
      successorReplayed: persisted.filter(entry => entry.successor?.replayed === true).length,
      successorCoalesced: persisted.filter(entry => entry.successor?.coalesced === true).length,
      successorInvalid: persisted.filter(entry => entry.successor?.invalid === true).length,
      successorBlocked: persisted.filter(entry => entry.successor?.blocked === true).length,
    });

    this.logger.info('Native policy profile refresh planning completed', result);
    return result;
  }
}

const policyNativeProfileRefreshPlanner = new PolicyNativeProfileRefreshPlanner();

export {
  buildResult,
  PolicyNativeProfileRefreshPlanner,
  policyNativeProfileRefreshPlanner,
  POLICY_NATIVE_PROFILE_REFRESH_PLANNER_VERSION,
};
