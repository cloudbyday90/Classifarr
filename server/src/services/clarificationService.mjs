import * as policyQuestionContext from '../utils/policyQuestionContext.mjs';
import { createStatusError, safeParseJson, parsePolicyQuestion, getQuestionOptionLibraryIds } from './clarificationUtils.mjs';
import { getAllQuestions, createQuestion, updateQuestion, deleteQuestion, matchQuestions, hasLanguagePresets as _hasLanguagePresets, isLanguageQuestionAllowed as _isLanguageQuestionAllowed } from './clarificationQuestionManager.mjs';
import { getThresholds, getTierForConfidence, getTierFromPolicyThresholds, isRequireAllConfirmationsEnabled, updateThreshold, recordResponse, getResponses } from './clarificationThresholdManager.mjs';
import { resolvePolicyQuestion as _resolvePolicyQuestion } from './clarificationPolicyResolution.mjs';
import { createSeedIntegrityState, invalidateSeedIntegrityCache, getSeedIntegritySummary, auditSeedIntegrity, getPendingClassifications } from './clarificationPendingQueries.mjs';
import {
  POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS,
  isPolicyRuntimeQuestionResolutionAction,
  parsePolicyRuntimeQuestionAnswer,
} from './policyRuntimeQuestionAnswerContract.mjs';
import {
  policyRuntimeDestinationEvidenceCommandService,
} from './policyRuntimeDestinationEvidenceCommandService.mjs';
import {
  buildPolicyRuntimeDestinationEvidenceAuthorizationContext,
} from './policyRuntimeDestinationEvidenceExecutionAuthorization.mjs';
import {
  policyCandidateCorrectionRepresentativeReviewCorpusCaptureService,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureService.mjs';
import {
  policyRuntimeExactItemMemoryAutoLearningService,
} from './policyRuntimeExactItemMemoryAutoLearningService.mjs';

class ClarificationService {
  constructor(deps = {}) {
    this.policyQuestionContext = deps.policyQuestionContext || policyQuestionContext;
    this.runtimeDestinationEvidenceCommandService =
      deps.runtimeDestinationEvidenceCommandService ||
      policyRuntimeDestinationEvidenceCommandService;
    this.reviewCorpusCaptureService = deps.reviewCorpusCaptureService ||
      policyCandidateCorrectionRepresentativeReviewCorpusCaptureService;
    this.runtimeExactItemMemoryAutoLearningService =
      deps.runtimeExactItemMemoryAutoLearningService ||
      policyRuntimeExactItemMemoryAutoLearningService;
    this._seedState = createSeedIntegrityState(deps.seedIntegrityCacheTtlMs);
  }

  createStatusError(...args) { return createStatusError(...args); }
  parsePolicyQuestion(...args) { return parsePolicyQuestion(...args); }
  safeParseJson(...args) { return safeParseJson(...args); }
  getQuestionOptionLibraryIds(...args) { return getQuestionOptionLibraryIds(...args); }
  getTierFromPolicyThresholds(...args) { return getTierFromPolicyThresholds(...args); }
  isRequireAllConfirmationsEnabled(...args) { return isRequireAllConfirmationsEnabled(...args); }
  getResponses(...args) { return getResponses(...args); }
  async hasLanguagePresets(...args) { return _hasLanguagePresets(...args); }
  async isLanguageQuestionAllowed(...args) { return _isLanguageQuestionAllowed(...args); }

  get seedIntegrityWarnings() {
    return this._seedState.warnings;
  }

  invalidateSeedIntegrityCache() {
    invalidateSeedIntegrityCache(this._seedState);
  }

  async getSeedIntegritySummary(opts) {
    return getSeedIntegritySummary(this._seedState, opts);
  }

  async auditSeedIntegrity(opts) {
    return auditSeedIntegrity(this._seedState, opts);
  }

  async getThresholds(...args) { return getThresholds(...args); }

  async getTierForConfidence(confidence) {
    return getTierForConfidence(confidence, { auditSeedIntegrity: (opts) => this.auditSeedIntegrity(opts) });
  }

  async getAllQuestions(...args) { return getAllQuestions(...args); }

  async createQuestion(questionData) {
    const result = await createQuestion(questionData);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async updateQuestion(...args) { return updateQuestion(...args); }

  async deleteQuestion(questionId) {
    const result = await deleteQuestion(questionId);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async updateThreshold(tier, updates) {
    const result = await updateThreshold(tier, updates);
    this.invalidateSeedIntegrityCache();
    return result;
  }

  async matchQuestions(metadata, maxQuestions = 3) {
    return matchQuestions(metadata, maxQuestions, {
      auditSeedIntegrity: (opts) => this.auditSeedIntegrity(opts)
    });
  }

  async recordResponse(...args) { return recordResponse(...args); }

  async resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule = true) {
    return _resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule, {
      policyQuestionContext: this.policyQuestionContext
    });
  }

  async resolveRuntimeQuestionAnswer(
    classificationId,
    payload,
    resolvedBy,
    { authenticated = false, operatorAuditActorId = null } = {},
  ) {
    const parsed = parsePolicyRuntimeQuestionAnswer(payload);
    if (!parsed.ok) {
      throw createStatusError('Invalid policy question answer', 400, parsed.reason);
    }
    if (!isPolicyRuntimeQuestionResolutionAction(parsed.answer.actionId)) {
      throw createStatusError(
        'This action cannot resolve a policy question',
        400,
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.ACTION_UNAVAILABLE,
      );
    }

    const resolution = await _resolvePolicyQuestion(
      classificationId,
      parsed.answer.destinationLibraryId,
      null,
      resolvedBy,
      false,
      {
        policyQuestionContext: this.policyQuestionContext,
        answerContract: parsed.answer,
        runtimeDestinationEvidenceCommandService: this.runtimeDestinationEvidenceCommandService,
        runtimeDestinationEvidenceAuthorizationContext:
          buildPolicyRuntimeDestinationEvidenceAuthorizationContext({
            actorId: resolvedBy,
            authenticated,
          }),
        reviewCorpusCaptureService: this.reviewCorpusCaptureService,
        reviewCorpusActorId: operatorAuditActorId,
      },
    );

    const automaticExactItemMemory = await this.runtimeExactItemMemoryAutoLearningService.record({
      classificationId,
      actorId: resolvedBy,
      authenticated,
      answerActionId: parsed.answer.actionId,
      resolutionSucceeded: resolution?.success === true,
    });

    return {
      ...resolution,
      automaticExactItemMemory,
    };
  }

  async getPendingClassifications() {
    return getPendingClassifications(this.policyQuestionContext);
  }
}

export const clarificationService = new ClarificationService();
