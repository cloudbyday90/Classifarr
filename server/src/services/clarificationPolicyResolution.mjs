import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { createStatusError, safeParseJson, parsePolicyQuestion, getQuestionOptionLibraryIds } from './clarificationUtils.mjs';
import { isPolicyRuntimeQuestionPersistenceEnvelope } from './policyRuntimeQuestionPersistenceContract.mjs';

const logger = createLogger('PolicyResolution');

export async function resolvePolicyQuestion(classificationId, selectedLibraryId, selectedOption, resolvedBy, generateRule = true, { policyQuestionContext }) {
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
                `SELECT status, library_id, library_name
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
            if (
                existingClassification.status &&
                ['completed', 'routed'].includes(existingClassification.status) &&
                Number.isInteger(existingLibraryId) &&
                existingLibraryId === selectedLibraryId
            ) {
                return {
                    success: true,
                    classificationId,
                    libraryId: selectedLibraryId,
                    libraryName: existingClassification.library_name || null,
                    generatedPattern: null,
                    shouldRoute: false,
                    alreadyResolved: true,
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
        const allowLegacyRuleGeneration = generateRule === true &&
            !isPolicyRuntimeQuestionPersistenceEnvelope(policyQuestion);
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

            const optionLibraryIds = getQuestionOptionLibraryIds(policyQuestion);
            if (optionLibraryIds.length > 0 && !optionLibraryIds.includes(selectedLibraryId)) {
                throw createStatusError(
                    'Selected library is no longer valid for this policy question',
                    400,
                    'invalid_policy_option'
                );
            }
        }

        const selectedLibraryName = selectedLibrary.name || classification.library_name;
        const metadata = typeof classification.metadata === 'string'
            ? (safeParseJson(classification.metadata) || {})
            : (classification.metadata || {});

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
                `Resolved by ${resolvedBy}: ${selectedOption}`
            ]
        );

        await classificationOutcomeService.recordOutcome(classificationId, {
            type: 'resolved',
            source: 'policy_question',
            actor: resolvedBy,
            selected_option: selectedOption || null,
            final_library_id: selectedLibraryId,
            final_library_name: selectedLibraryName
        }, { client });

        let learnedPattern = null;
        if (allowLegacyRuleGeneration && metadata.tmdb_id) {

            learnedPattern = await classificationEvidenceService.rememberExactMatch({
                tmdbId: metadata.tmdb_id,
                mediaType: classification.media_type,
                libraryId: selectedLibraryId,
                payload: {
                    title: classification.title,
                    resolved_from: 'policy_question',
                    original_question: policyQuestion?.question || null,
                    selected_option: selectedOption,
                },
                createdBy: resolvedBy,
                client,
                payloadColumn: 'metadata',
                conflictMode: 'update_metadata'
            });

            logger.info('Generated learned pattern from policy resolution', {
                tmdbId: metadata.tmdb_id,
                libraryId: selectedLibraryId,
                patternId: learnedPattern?.id
            });

            const itemGenres = normalizeMetadataList(metadata.genres);
            if (itemGenres.length > 0) {
                await classificationEvidenceService.reinforceGenrePatterns({
                    mediaType: classification.media_type,
                    libraryId: selectedLibraryId,
                    genres: itemGenres,
                    createdBy: resolvedBy,
                    client
                });
                logger.info('Wrote genre patterns from policy resolution', {
                    genres: itemGenres,
                    libraryId: selectedLibraryId,
                    mediaType: classification.media_type
                });
            }
        }

        logger.info('Policy question resolved', {
            classificationId,
            selectedLibrary: classification.library_name,
            resolvedBy,
            generatedRule: !!learnedPattern
        });

        return {
            success: true,
            classificationId,
            libraryId: selectedLibraryId,
            libraryName: selectedLibraryName,
            generatedPattern: learnedPattern,
            shouldRoute: true,
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
