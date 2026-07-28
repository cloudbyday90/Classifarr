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
  buildCircuitDecision,
} from './policyNativeProfileRefreshCircuit.mjs';
import {
  policyNativeProfileRefreshCircuitCompactionRepository,
} from './policyNativeProfileRefreshCircuitCompactionRepository.mjs';
import {
  policyNativeProfileRefreshCircuitRepository,
} from './policyNativeProfileRefreshCircuitRepository.mjs';
import {
  isPolicyNativeProfileRefreshCircuitFailureCode,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS,
} from './policyNativeProfileRefreshCircuitVocabulary.mjs';
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
  circuitBlocked = 0,
  circuitOpened = 0,
  circuitProbeQueued = 0,
  circuitProbeReplayed = 0,
  circuitProbeCoalesced = 0,
  circuitProbeInvalid = 0,
  circuitProbeDeferred = 0,
  circuitsCompacted = 0,
  outboxRowsCompacted = 0,
  compactionFailed = false,
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
    circuitBlocked,
    circuitOpened,
    circuitProbeQueued,
    circuitProbeReplayed,
    circuitProbeCoalesced,
    circuitProbeInvalid,
    circuitProbeDeferred,
    circuitsCompacted,
    outboxRowsCompacted,
    compactionFailed,
  };
}

class PolicyNativeProfileRefreshPlanner {
  constructor({
    dbClient = database,
    candidateRepository = policyNativeProfileRefreshCandidateRepository,
    buildRequest = buildPolicyNativeProfileRefreshRequest,
    failureRepository = policyNativeProfileRefreshFailureRepository,
    buildSuccessor = buildPolicyNativeProfileRefreshSuccessor,
    circuitRepository = policyNativeProfileRefreshCircuitRepository,
    circuitCompactionRepository = policyNativeProfileRefreshCircuitCompactionRepository,
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
    this.circuitRepository = circuitRepository;
    this.circuitCompactionRepository = circuitCompactionRepository;
    this.evaluateTerminalFailure = evaluateTerminalFailure;
    this.enqueue = enqueue;
    this.now = now;
    this.logger = loggerInstance;
  }

  async queueCircuitProbe({ client, request, now }) {
    const failureHistory = await this.failureRepository.findHistory({
      client,
      libraryId: request.record.libraryId,
      sourceEventId: request.record.sourceEventId,
    });
    if (!failureHistory) {
      return { invalid: true };
    }

    const probeRequest = this.buildSuccessor({
      record: request.record,
      failedOutboxId: failureHistory.failedOutboxId,
      failureCount: failureHistory.failureCount,
      now,
    });
    if (probeRequest.ready !== true) {
      return { invalid: true };
    }

    const probe = await this.enqueue({ client, record: probeRequest.record });
    const processingState = probe?.outbox?.processingState;
    const probeActive = [
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PENDING,
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING,
    ].includes(processingState);

    if (probe?.coalesced === true || !probeActive) {
      const deferred = await this.circuitRepository.deferProbe({
        client,
        libraryId: request.record.libraryId,
        sourceEventId: request.record.sourceEventId,
        now,
      });
      return {
        ...probe,
        deferred: deferred.ready === true,
        invalid: deferred.ready !== true,
      };
    }

    const transition = await this.circuitRepository.startProbe({
      client,
      libraryId: request.record.libraryId,
      sourceEventId: request.record.sourceEventId,
      probeOutboxId: probe.outbox.id,
      now,
    });
    if (transition.ready !== true) {
      throw new Error('Native profile refresh circuit probe transition failed.');
    }

    return { ...probe, started: true };
  }

  async persistRequests(requests) {
    if (requests.length === 0) return [];

    if (typeof this.dbClient?.withTransaction !== 'function') {
      throw new TypeError('Native profile refresh planning requires transactional persistence.');
    }

    return this.dbClient.withTransaction(async client => {
      const results = [];
      for (const request of requests) {
        const now = this.now();
        const circuit = await this.circuitRepository.lock({
          client,
          libraryId: request.record.libraryId,
          sourceEventId: request.record.sourceEventId,
        });
        const circuitDecision = buildCircuitDecision({ circuit, now });
        if (circuitDecision.actionId === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.BLOCK) {
          results.push({ primary: null, successor: null, circuitBlocked: true });
          continue;
        }
        if (circuitDecision.actionId === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PROBE) {
          const circuitProbe = await this.queueCircuitProbe({ client, request, now });
          results.push({ primary: null, successor: null, circuitProbe });
          continue;
        }

        const primary = await this.enqueue({ client, record: request.record });
        let successor = null;
        let circuitTransition = null;

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
            if (isPolicyNativeProfileRefreshCircuitFailureCode(failureHistory.failureCode)) {
              circuitTransition = await this.circuitRepository.recordFailure({
                client,
                libraryId: request.record.libraryId,
                sourceEventId: request.record.sourceEventId,
                failedOutboxId: failureHistory.failedOutboxId,
                failureCount: failureHistory.failureCount,
                failureCode: failureHistory.failureCode,
                now,
              });
            }
            if (terminalFailure.scheduleSuccessor !== true) {
              successor = { blocked: true, reasonCodes: terminalFailure.reasonCodes };
            } else if (circuitTransition?.circuit?.circuitState ===
              POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN) {
              successor = {
                blocked: true,
                reasonCodes: ['native_profile_refresh_circuit_open'],
              };
            } else {
              const successorRequest = this.buildSuccessor({
                record: request.record,
                failedOutboxId: failureHistory.failedOutboxId,
                failureCount: failureHistory.failureCount,
                now,
              });

              if (successorRequest.ready === true) {
                successor = await this.enqueue({ client, record: successorRequest.record });
              } else {
                successor = { invalid: true };
              }
            }
          }
        }

        results.push({ primary, successor, circuitTransition });
      }
      return results;
    });
  }

  async compactHistory(requests) {
    if (typeof this.dbClient?.query !== 'function') {
      return { circuitsCompacted: 0, outboxRowsCompacted: 0, skipped: true };
    }

    try {
      return await this.circuitCompactionRepository.compact({
        client: this.dbClient,
        protectedRevisions: requests.map(request => ({
          libraryId: request.record.libraryId,
          sourceEventId: request.record.sourceEventId,
        })),
      });
    } catch {
      this.logger.warn('Native profile refresh circuit compaction failed', {
        reasonId: 'native_profile_refresh_circuit_compaction_failed',
      });
      return {
        circuitsCompacted: 0,
        outboxRowsCompacted: 0,
        failed: true,
      };
    }
  }

  async run() {
    const candidates = await this.candidateRepository.findCandidates({ client: this.dbClient });
    const requests = candidates.map(candidate => ({
      candidate,
      request: this.buildRequest(candidate),
    }));
    const readyRequests = requests.filter(({ request }) => request.ready === true);
    const persisted = await this.persistRequests(readyRequests.map(({ request }) => request));
    const compaction = await this.compactHistory(readyRequests.map(({ request }) => request));
    const result = buildResult({
      scanned: candidates.length,
      eligible: readyRequests.length,
      queued: persisted.filter(entry =>
        entry.primary && entry.primary.replayed !== true && entry.primary.coalesced !== true
      ).length,
      replayed: persisted.filter(entry => entry.primary?.replayed === true).length,
      coalesced: persisted.filter(entry => entry.primary?.coalesced === true).length,
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
      circuitBlocked: persisted.filter(entry => entry.circuitBlocked === true).length,
      circuitOpened: persisted.filter(entry => entry.circuitTransition?.opened === true).length,
      circuitProbeQueued: persisted.filter(entry =>
        entry.circuitProbe &&
        entry.circuitProbe.started === true &&
        entry.circuitProbe.replayed !== true &&
        entry.circuitProbe.coalesced !== true
      ).length,
      circuitProbeReplayed: persisted.filter(entry =>
        entry.circuitProbe?.started === true && entry.circuitProbe.replayed === true
      ).length,
      circuitProbeCoalesced: persisted.filter(entry => entry.circuitProbe?.coalesced === true).length,
      circuitProbeInvalid: persisted.filter(entry => entry.circuitProbe?.invalid === true).length,
      circuitProbeDeferred: persisted.filter(entry => entry.circuitProbe?.deferred === true).length,
      circuitsCompacted: compaction.circuitsCompacted,
      outboxRowsCompacted: compaction.outboxRowsCompacted,
      compactionFailed: compaction.failed === true,
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
