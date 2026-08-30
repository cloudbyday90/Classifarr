import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { createStatusError, safeParseJson, parsePolicyQuestion, getQuestionOptionLibraryIds } from './clarificationUtils.mjs';
import { isPolicyRuntimeQuestionPersistenceEnvelope } from './policyRuntimeQuestionPersistenceContract.mjs';
import { policyNativePendingResolutionProvenanceService } from './policyNativePendingResolutionProvenance.mjs';
import { policyRuntimeResolutionLearningService } from './policyRuntimeResolutionLearning.mjs';
import { getRuntimeQuestionNormalizationStatus } from './policyRuntimeQuestionNormalizer.mjs';
import {
    POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
    POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS,
    buildPolicyRuntimeQuestionAnswerOutcome,
    getPolicyRuntimeQuestionAnswerSelectedOption,
    validatePolicyRuntimeQuestionAnswer,
} from './policyRuntimeQuestionAnswerContract.mjs';
import {
    buildCurrentLibraryCandidateRetrievalOutcomeAttribution,
} from './currentLibraryCandidateRetrievalOutcomeAttribution.mjs';

const logger = createLogger('PolicyResolution');

function getRecordedRuntimeQuestionAnswer(metadata) {
    const details = metadata && typeof metadata === 'object'
        ? metadata.classification_details
        : null;
    const outcome = details && typeof details === 'object'
        ? details.outcome_link
        : null;
    const answer = outcome && typeof outcome === 'object'
        ? outcome.runtime_question_answer
        : null;

    return answer && typeof answer === 'object' ? answer : null;
}

function isIdempotentRuntimeQuestionAnswer(recordedAnswer, answer) {
    return recordedAnswer?.contract_version === answer?.contractVersion &&
        recordedAnswer?.contract_fingerprint === answer?.contractFingerprint &&
        recordedAnswer?.action_id === answer?.actionId &&
        Number(recordedAnswer?.destination_library_id) === Number(answer?.destinationLibraryId);
}

function createAnswerContractError(validation) {
    const reason = validation?.reason || POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_ANSWER;
    const staleReasons = new Set([
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.STALE_QUESTION,
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_QUESTION,
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH,
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.UNSUPPORTED_CONTRACT_VERSION,
        POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.ACTION_UNAVAILABLE,
    ]);
    const message = reason === POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.STALE_QUESTION
        ? 'Policy question is stale and must be retried'
        : reason === POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.ACTION_UNAVAILABLE
            ? 'This policy question action is not currently available'
            : reason === POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH
                ? 'Policy question changed and must be refreshed before it can be answered'
                : 'Invalid policy question answer';

    return createStatusError(message, staleReasons.has(reason) ? 409 : 400, reason);
}

export async function resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule = true, {
    policyQuestionContext,
    answerContract = null,
    runtimeDestinationEvidenceCommandService = null,
    runtimeDestinationEvidenceAuthorizationContext = null,
} = {}) {
    try {
        const result = await db.withTransaction(async (client) => {

        const classResult = await client.query(
            `SELECT ch.*
             FROM classification_history ch
             WHERE ch.id = $1
               AND ch.status = 'awaiting_decision'
             FOR UPDATE`,
            [classificationId]
        );

        if (classResult.rows.length === 0) {
            const libraryCheck = await client.query(
                'SELECT id FROM libraries WHERE id = $1',
                [selectedLibraryId]
            );

            if (libraryCheck.rows.length === 0) {
                const invalidLibraryError = new Error('Invalid library_id');
                invalidLibraryError.statusCode = 400;
                throw invalidLibraryError;
            }

            const existenceCheck = await client.query(
                `SELECT status, library_id, library_name, metadata
                 FROM classification_history
                 WHERE id = $1`,
                [classificationId]
            );

            if (existenceCheck.rows.length === 0) {
                const notFoundError = new Error('Classification not found');
                notFoundError.statusCode = 404;
                throw notFoundError;
            }

            const existingClassification = existenceCheck.rows[0];
            const existingLibraryId = Number(existingClassification.library_id);
            const existingMetadata = typeof existingClassification.metadata === 'string'
                ? (safeParseJson(existingClassification.metadata) || {})
                : (existingClassification.metadata || {});
            const answerIsIdempotent = answerContract && isIdempotentRuntimeQuestionAnswer(
                getRecordedRuntimeQuestionAnswer(existingMetadata),
                answerContract,
            );
            if (
                existingClassification.status &&
                ['completed', 'routed'].includes(existingClassification.status) &&
                Number.isInteger(existingLibraryId) &&
                existingLibraryId === selectedLibraryId &&
                (!answerContract || answerIsIdempotent)
            ) {
                return {
                    success: true,
                    classificationId,
                    libraryId: selectedLibraryId,
                    libraryName: existingClassification.library_name || null,
                    generatedPattern: null,
                    shouldRoute: false,
                    alreadyResolved: true,
                    idempotent: answerIsIdempotent === true,
                };
            }

            const staleResolutionError = new Error('Classification is no longer awaiting decision');
            staleResolutionError.statusCode = 409;
            throw staleResolutionError;
        }

        const classification = classResult.rows[0];
        const selectedLibraryResult = await client.query(
            `SELECT id, name, arr_type, media_type, is_active
             FROM libraries
             WHERE id = $1`,
            [selectedLibraryId]
        );

        if (selectedLibraryResult.rows.length === 0) {
            throw createStatusError('Invalid library_id', 400, 'invalid_library_id');
        }

        const selectedLibrary = selectedLibraryResult.rows[0];
        if (selectedLibrary.is_active !== true) {
            throw createStatusError('Selected library is inactive', 400, 'inactive_library');
        }

        const classificationMediaType = String(classification.media_type || '').toLowerCase();
        const selectedLibraryMediaType = String(selectedLibrary.media_type || '').toLowerCase();
        if (
            classificationMediaType &&
            selectedLibraryMediaType &&
            classificationMediaType !== selectedLibraryMediaType
        ) {
            throw createStatusError(
                'Selected library is not valid for this media type',
                400,
                'library_media_type_mismatch'
            );
        }

        const policyQuestion = parsePolicyQuestion(classification.policy_question);
        let runtimeQuestionAnswerContract = null;
        const normalizationStatus = getRuntimeQuestionNormalizationStatus(policyQuestion);
        if (policyQuestion && !normalizationStatus.actionable) {
            throw createStatusError(
                'Policy question must be refreshed before it can be resolved',
                409,
                'policy_question_normalization_required'
            );
        }
        const isNativeRuntimeQuestion = isPolicyRuntimeQuestionPersistenceEnvelope(policyQuestion);
        const isNormalizedRuntimeQuestion = normalizationStatus.contract === 'normalization';
        const legacyRuleGenerationRequested = generateRule === true &&
            !isNativeRuntimeQuestion &&
            !isNormalizedRuntimeQuestion;
        if (policyQuestion) {
            const {
                extractQuestionContext,
                getPolicyQuestionContextVersion,
                isPolicyQuestionStale,
            } = policyQuestionContext;
            const currentContextVersion = await getPolicyQuestionContextVersion(
                client,
                extractQuestionContext(policyQuestion)
            );

            if (isPolicyQuestionStale(policyQuestion, currentContextVersion)) {
                throw createStatusError(
                    'Policy question is stale and must be retried',
                    409,
                    'policy_question_stale'
                );
            }

            if (answerContract) {
                const answerValidation = validatePolicyRuntimeQuestionAnswer({
                    classification,
                    question: policyQuestion,
                    answer: answerContract,
                    isStale: false,
                    currentContextVersion,
                });
                if (!answerValidation.ok) {
                    throw createAnswerContractError(answerValidation);
                }
                answerContract = answerValidation.answer;
                runtimeQuestionAnswerContract = answerValidation.contract;
            }

            const optionLibraryIds = getQuestionOptionLibraryIds(policyQuestion);
            const restrictToCandidateDestinations = !answerContract ||
                answerContract.actionId === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION;
            if (restrictToCandidateDestinations && optionLibraryIds.length > 0 && !optionLibraryIds.includes(selectedLibraryId)) {
                throw createStatusError(
                    'Selected library is no longer valid for this policy question',
                    400,
                    'invalid_policy_option'
                );
            }
        }

        if (answerContract && !policyQuestion) {
            throw createAnswerContractError({
                reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_QUESTION,
            });
        }

        const selectedLibraryName = selectedLibrary.name || classification.library_name;
        const classificationMetadata = typeof classification.metadata === 'string'
            ? (safeParseJson(classification.metadata) || {})
            : (classification.metadata || {});
        const currentLibraryCandidateRetrievalOutcomeAttribution = answerContract
            ? buildCurrentLibraryCandidateRetrievalOutcomeAttribution({
                classificationDetails: classificationMetadata.classification_details,
                answer: answerContract,
                candidateDestinations: runtimeQuestionAnswerContract?.candidate_destinations,
                selectedDestinationLibraryId: selectedLibraryId,
            })
            : null;
        let nativeResolutionProvenance = null;
        const serverSelectedOption = answerContract
            ? getPolicyRuntimeQuestionAnswerSelectedOption({
                question: policyQuestion,
                answer: answerContract,
            })
            : selectedOption;

        if (answerContract && !serverSelectedOption) {
            throw createAnswerContractError({
                reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_QUESTION,
            });
        }

        if (isNativeRuntimeQuestion) {
            nativeResolutionProvenance = policyNativePendingResolutionProvenanceService.build({
                classification: { id: classificationId },
                persistedQuestion: policyQuestion,
                selectedDestination: {
                    libraryId: selectedLibraryId,
                    libraryName: selectedLibraryName,
                },
                selectedOption: serverSelectedOption,
            });

            if (nativeResolutionProvenance.audit.ok !== true) {
                throw createStatusError(
                    'Native policy question cannot be safely resolved and must be retried',
                    409,
                    'native_policy_question_invalid'
                );
            }

            const provenanceWrite = await classificationOutcomeService.recordOutcome(
                classificationId,
                policyNativePendingResolutionProvenanceService.toOutcomePatch(
                    nativeResolutionProvenance
                ),
                { client }
            );
            if (provenanceWrite.updated !== true) {
                throw createStatusError(
                    'Could not record the native pending-resolution decision',
                    500,
                    'native_pending_resolution_record_failed'
                );
            }
        }

        const runtimeResolutionLearning = isNativeRuntimeQuestion
            ? null
            : policyRuntimeResolutionLearningService.build({
                classification: { id: classificationId },
                question: policyQuestion,
                destination: {
                    libraryId: selectedLibraryId,
                    libraryName: selectedLibraryName,
                },
                selectedOption: serverSelectedOption,
                answerContract,
                actorId: resolvedBy,
                legacyRuleGenerationRequested,
            });

        if (runtimeResolutionLearning && runtimeResolutionLearning.audit.ok !== true) {
            throw createStatusError(
                'Policy question outcome could not be safely recorded',
                500,
                'runtime_resolution_learning_invalid'
            );
        }

        await client.query(
            `UPDATE classification_history 
             SET status = 'completed',
                 library_id = $2,
                 library_name = $3,
                 confidence = 100,
                 method = 'manual_classification',
                 reason = $4,
                 pending_reason = NULL,
                 policy_question = NULL
             WHERE id = $1`,
            [
                classificationId,
                selectedLibraryId,
                selectedLibraryName,
                `Resolved by ${resolvedBy}: ${serverSelectedOption}`
            ]
        );

        const resolutionOutcomeWrite = await classificationOutcomeService.recordOutcome(classificationId, {
            type: 'resolved',
            source: 'policy_question',
            actor: resolvedBy,
            selected_option: serverSelectedOption || null,
            final_library_id: selectedLibraryId,
            final_library_name: selectedLibraryName,
            runtime_question_answer: answerContract
                ? buildPolicyRuntimeQuestionAnswerOutcome(answerContract)
                : undefined,
            ...(currentLibraryCandidateRetrievalOutcomeAttribution
                ? {
                    current_library_candidate_retrieval_outcome_attribution:
                        currentLibraryCandidateRetrievalOutcomeAttribution,
                }
                : {}),
            ...(runtimeResolutionLearning
                ? policyRuntimeResolutionLearningService.toOutcomePatch(runtimeResolutionLearning)
                : {}),
        }, { client });
        if (resolutionOutcomeWrite.updated !== true) {
            throw createStatusError(
                'Could not record the policy question outcome',
                500,
                'policy_question_outcome_record_failed'
            );
        }

        const runtimeDestinationEvidence = isNativeRuntimeQuestion &&
            answerContract?.actionId !== POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE &&
            runtimeDestinationEvidenceAuthorizationContext?.authenticated === true &&
            typeof runtimeDestinationEvidenceCommandService?.execute === 'function'
            ? await runtimeDestinationEvidenceCommandService.execute({
                client,
                classificationId,
                actorId: resolvedBy,
                authorizationContext: runtimeDestinationEvidenceAuthorizationContext,
            })
            : null;

        logger.info('Policy question resolved', {
            classificationId,
            selectedLibrary: classification.library_name,
            resolvedBy,
            learningDecision: runtimeResolutionLearning?.decisionSummary?.decisionId ||
                nativeResolutionProvenance?.learningGuard?.decisionId || null,
            runtimeDestinationEvidence: runtimeDestinationEvidence?.statusId || null,
        });

        return {
            success: true,
            classificationId,
            libraryId: selectedLibraryId,
            libraryName: selectedLibraryName,
            generatedPattern: null,
            runtimeResolutionLearning: runtimeResolutionLearning
                ? {
                    statusId: runtimeResolutionLearning.statusId,
                    decision: runtimeResolutionLearning.decisionSummary,
                    reasonCodes: runtimeResolutionLearning.reasonCodes,
                }
                : null,
            nativeResolutionProvenance: nativeResolutionProvenance
                ? {
                    statusId: nativeResolutionProvenance.statusId,
                    selection: nativeResolutionProvenance.selection,
                    requestTimeDecision: nativeResolutionProvenance.requestTimeDecision,
                    learningGuard: nativeResolutionProvenance.learningGuard,
                    reasonCodes: nativeResolutionProvenance.reasonCodes,
                }
                : null,
            runtimeDestinationEvidence: runtimeDestinationEvidence
                ? {
                    statusId: runtimeDestinationEvidence.statusId,
                    reasonCodes: runtimeDestinationEvidence.reasonCodes,
                    provenance: runtimeDestinationEvidence.provenance,
                    admission: runtimeDestinationEvidence.admission,
                }
                : null,
            answerActionId: answerContract?.actionId || null,
            shouldRoute: answerContract?.actionId !== POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE,
        };
        }); // end withTransaction
        return result;
    } catch (error) {
        if (error.statusCode && error.statusCode < 500) {
            logger.warn('Policy question resolution rejected', {
                classificationId,
                selectedLibraryId,
                statusCode: error.statusCode,
                error: error.message
            });
        } else {
            logger.error('Error resolving policy question', { error: error.message }, { error });
        }
        throw error;
    }
}
