/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ClassificationIntakeReceiptRepository } from './classificationIntakeReceiptRepository.mjs';
import { isClassificationIntakeReason } from './classificationIntakeComparison.mjs';
import { normalizeQueueTaskFailureReasonId } from './queueTaskFailureReason.mjs';
import { readCorrectionDecisionContext } from './classificationDestinationDecision.mjs';

const TRANSITIONS = new Set(['queued', 'processing', 'retry_scheduled', 'completed', 'failed']);
const RECEIPT_WARNING_INTERVAL_MS = 60_000;
const positive = value => Number.isSafeInteger(value) && value > 0;

export class ClassificationIntakeReceiptService {
  constructor({ db, logger, repository = new ClassificationIntakeReceiptRepository({ db }), now = Date.now } = {}) {
    this.repository = repository;
    this.logger = logger;
    this.now = now;
    this.lastWarningAt = Number.NEGATIVE_INFINITY;
    this.suppressedWarnings = 0;
  }

  warn(reasonCode) {
    const at = this.now();
    if (at - this.lastWarningAt < RECEIPT_WARNING_INTERVAL_MS) {
      this.suppressedWarnings += 1;
      return;
    }
    this.logger?.warn?.('Classification intake receipt could not be recorded', {
      reasonCode, suppressedWarnings: this.suppressedWarnings,
    });
    this.lastWarningAt = at;
    this.suppressedWarnings = 0;
  }

  async record({ taskId, transition = null, attempts = null, classificationId = null,
    comparison = null, failureReasonId = null, decisionContext = null } = {}) {
    if (!positive(taskId) || (transition !== null && !TRANSITIONS.has(transition)) ||
        (attempts !== null && (!Number.isInteger(attempts) || attempts < 0 || attempts > 10000)) ||
        (classificationId !== null && !positive(classificationId)) ||
        (decisionContext !== null && (!readCorrectionDecisionContext(decisionContext) || decisionContext.classificationId !== classificationId)) ||
        (comparison !== null && (!comparison || classificationId === null ||
          !['captured', 'not_captured'].includes(comparison.statusId) ||
          (comparison.statusId === 'captured' && comparison.reasonId !== null) ||
          (comparison.statusId === 'not_captured' && !isClassificationIntakeReason(comparison.reasonId))))) {
      return false;
    }
    const failureCode = failureReasonId === null ? null : normalizeQueueTaskFailureReasonId(failureReasonId);
    try {
      const persisted = await this.repository.upsert([
        taskId, attempts, classificationId,
        comparison?.statusId ?? null, comparison?.reasonId ?? null, failureCode, decisionContext,
      ]);
      if (!persisted) this.warn('task_absent');
      return persisted;
    } catch {
      this.warn('receipt_write_failed');
      return false;
    }
  }

  recordQueued(taskId) { return this.record({ taskId, transition: 'queued' }); }
  recordProcessing(taskId, attempts) { return this.record({ taskId, transition: 'processing', attempts }); }
  recordClassification(taskId, classificationId, comparison, capture = null) {
    const decisionContext = capture === null ? null : readCorrectionDecisionContext({ classificationId, capture });
    return this.record({ taskId, classificationId, comparison, decisionContext });
  }
  recordTerminal(taskId, transition, attempts = null, failureReasonId = null) {
    if (!['completed', 'failed', 'retry_scheduled'].includes(transition)) return Promise.resolve(false);
    return this.record({ taskId, transition, attempts, failureReasonId });
  }

  async reconcileAndPrune() {
    const result = { reconciled: 0, linked: 0, recovered: 0, pruned: 0 };
    try { result.reconciled = await this.repository.reconcile(); }
    catch { this.warn('receipt_reconcile_failed'); }
    try { result.linked = await this.repository.reconcileClassificationLinks(); }
    catch { this.warn('receipt_link_reconcile_failed'); }
    try { result.recovered = await this.repository.recoverDecisionContexts(); }
    catch { this.warn('receipt_decision_recovery_failed'); }
    try { result.pruned = await this.repository.prune(); }
    catch { this.warn('receipt_prune_failed'); }
    return result;
  }
}
