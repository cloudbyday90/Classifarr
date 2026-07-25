import { QueueOmdbEnrichmentService } from './queueOmdbEnrichmentService.mjs';
import { QueueWebSearchEnrichmentService } from './queueWebSearchEnrichmentService.mjs';
import { QueueTmdbResolutionService } from './queueTmdbResolutionService.mjs';
import { QueueClassificationHistoryService } from './queueClassificationHistoryService.mjs';
import { EnrichmentItemStateService } from './enrichmentItemStateService.mjs';
import * as metadataEnrichment from '../utils/metadataEnrichment.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';
import { parsePayload } from '../utils/queueHelpers.mjs';
import { queryWithTimeout as _sharedQueryWithTimeout } from '../utils/queryWithTimeout.mjs';
import { processRatingNormalization as _processRatingNormalization } from './queueTaskProcessorRating.mjs';
import { resolveSourceLibraryName as _resolveSourceLibraryName, processMetadataEnrichmentTask as _processMetadataEnrichmentTask } from './queueTaskProcessorEnrichment.mjs';
import { rebuildImageIndexes as _rebuildImageIndexes } from './queueTaskProcessorIndexing.mjs';
import {
    buildClassificationDestinationSummary,
} from './classificationResultOutcomeSummary.mjs';
import {
    POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS,
    policyRequestImportDestinationAdmissionService,
} from './policyRequestImportDestinationAdmission.mjs';

function parseEnvMs(envValue, defaultValue) {
    const parsed = Number.parseInt(envValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export class QueueTaskProcessorService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.classificationService = deps.classificationService;
        this.omdbService = deps.omdbService;
        this.tmdbService = deps.tmdbService;
        this.completeTask = deps.completeTask || (async () => {});
        this.failTask = deps.failTask || (async () => {});
        this.policyRequestImportDestinationAdmissionService =
            deps.policyRequestImportDestinationAdmissionService || policyRequestImportDestinationAdmissionService;
        this.ratingNormalizer = deps.ratingNormalizer || ratingNormalizer;
        this.metadataEnrichment = deps.metadataEnrichment || metadataEnrichment;
        this.enrichmentItemStateService = deps.enrichmentItemStateService || new EnrichmentItemStateService({
            db: this.db,
            logger: this.logger
        });
        this.queryWithTimeout = deps.queryWithTimeout || ((sql, params, ms) => _sharedQueryWithTimeout(this.db, sql, params, ms));
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
        this.omdbCircuitWarnThrottleMs = deps.omdbCircuitWarnThrottleMs || 60_000;
        this.omdbSslWarnThrottleMs = deps.omdbSslWarnThrottleMs || parseEnvMs(process.env.OMDB_SSL_WARN_THROTTLE_MS, 15 * 60 * 1000);
        this.omdbSslBlockMs = deps.omdbSslBlockMs || parseEnvMs(process.env.OMDB_SSL_BLOCK_MS, 15 * 60 * 1000);
        this.omdbSslRecoveryProbeMs = deps.omdbSslRecoveryProbeMs || parseEnvMs(process.env.OMDB_SSL_RECOVERY_PROBE_MS, 60 * 1000);
        this.queueOmdbEnrichmentService = deps.queueOmdbEnrichmentService || new QueueOmdbEnrichmentService({
            db: this.db,
            logger: this.logger,
            omdbService: this.omdbService,
            queryWithTimeout: (...args) => this.queryWithTimeout(...args),
            isOmdbSslBlocked: (...args) => this.isOmdbSslBlocked(...args),
            getRuntimeState: () => ({
                omdbLimitHit: this.omdbLimitHit,
                lastOmdbCircuitWarnAt: this.lastOmdbCircuitWarnAt,
                lastOmdbSslWarnAt: this.lastOmdbSslWarnAt,
                omdbSslBlockedUntil: this.omdbSslBlockedUntil,
            }),
            setRuntimeState: (patch) => {
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbLimitHit')) {
                    this.omdbLimitHit = patch.omdbLimitHit;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbCircuitWarnAt')) {
                    this.lastOmdbCircuitWarnAt = patch.lastOmdbCircuitWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbSslWarnAt')) {
                    this.lastOmdbSslWarnAt = patch.lastOmdbSslWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbSslBlockedUntil')) {
                    this.omdbSslBlockedUntil = patch.omdbSslBlockedUntil;
                }
            },
            omdbCircuitWarnThrottleMs: this.omdbCircuitWarnThrottleMs,
            omdbSslWarnThrottleMs: this.omdbSslWarnThrottleMs,
            omdbSslBlockMs: this.omdbSslBlockMs,
        });
        this.queueWebSearchEnrichmentService = deps.queueWebSearchEnrichmentService
            || new QueueWebSearchEnrichmentService({
            logger: this.logger,
        });
        this.queueTmdbResolutionService = deps.queueTmdbResolutionService || new QueueTmdbResolutionService({
            logger: this.logger,
            tmdbService: this.tmdbService,
            queryWithTimeout: (...args) => this.queryWithTimeout(...args),
        });
        this.queueClassificationHistoryService = deps.queueClassificationHistoryService || new QueueClassificationHistoryService({
            db: this.db,
            logger: this.logger,
        });
    }

    async resolveSourceLibraryName(sourceLibraryId, sourceLibraryName, taskContext) {
        return _resolveSourceLibraryName(sourceLibraryId, sourceLibraryName, taskContext, { db: this.db, logger: this.logger });
    }

    async processRatingNormalization(task) {
        return _processRatingNormalization(task, {
            db: this.db,
            logger: this.logger,
            completeTask: (...args) => this.completeTask(...args),
            ratingNormalizer: this.ratingNormalizer
        });
    }

    async processClassificationTask(task) {
        const payload = parsePayload(task.payload);
        const result = await this.classificationService.classify({ ...payload, taskId: task.id });
        const requestDestinationAdmission = this.policyRequestImportDestinationAdmissionService.build({
            task,
            classification: result,
            questionReductionPlan: result.runtimeQuestionReductionPlan,
        });
        const completedResult = requestDestinationAdmission.statusId ===
            POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.NOT_APPLICABLE
            ? result
            : {
                ...result,
                requestDestinationAdmission,
            };
        await this.completeTask(task.id, completedResult);

        if (payload.itemId && result.bestMatch) {
            const newMetadata = {
                content_analysis: {
                    type: result.bestMatch.type,
                    confidence: result.bestMatch.confidence,
                    detected_at: new Date().toISOString()
                }
            };

            await this.queryWithTimeout(
                `UPDATE media_server_items 
                 SET metadata = metadata || $1::jsonb
                 WHERE id = $2`,
                [JSON.stringify(newMetadata), payload.itemId]
            );
        }

        if (task.webhook_log_id) {
            const destination = buildClassificationDestinationSummary(result);
            await this.db.query(
                `UPDATE webhook_log SET processing_status = 'completed', 
   routed_to_library = $2, processing_time_ms = EXTRACT(EPOCH FROM (NOW() - $3)) * 1000
   WHERE id = $1`,
                [task.webhook_log_id, destination.libraryName, task.started_at]
            );
        }
    }

    async processMetadataEnrichmentTask(task) {
        return _processMetadataEnrichmentTask(task, {
            db: this.db,
            logger: this.logger,
            metadataEnrichment: this.metadataEnrichment,
            enrichmentItemStateService: this.enrichmentItemStateService,
            resolveSourceLibraryName: (...args) => this.resolveSourceLibraryName(...args),
            queueOmdbEnrichmentService: this.queueOmdbEnrichmentService,
            queueWebSearchEnrichmentService: this.queueWebSearchEnrichmentService,
            queueTmdbResolutionService: this.queueTmdbResolutionService,
            queueClassificationHistoryService: this.queueClassificationHistoryService,
            queryWithTimeout: (...args) => this.queryWithTimeout(...args),
            completeTask: (...args) => this.completeTask(...args)
        });
    }

    async rebuildImageIndexes(task) {
        return _rebuildImageIndexes(task, {
            db: this.db,
            logger: this.logger,
            completeTask: (...args) => this.completeTask(...args)
        });
    }

    async processTask(task) {
        this.logger.info('Processing task', { taskId: task.id, taskType: task.task_type });

        try {
            switch (task.task_type) {
                case 'classification':
                    await this.processClassificationTask(task);
                    break;

                case 'metadata_enrichment':
                    await this.processMetadataEnrichmentTask(task);
                    break;

                case 'rating_normalization':
                    await this.processRatingNormalization(task);
                    break;

                case 'rebuild_hnsw_index':
                    await this.rebuildImageIndexes(task);
                    break;

                default:
                    this.logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, `Unknown task type: ${task.task_type}`, task.attempts, task.max_attempts);
            }
        } catch (error) {
            this.logger.error('Task processing failed', { taskId: task.id, error: error.message });
            await this.failTask(task.id, error.message, task.attempts, task.max_attempts);

            if (task.task_type === 'metadata_enrichment') {
                const payload = parsePayload(task.payload);
                if (payload?.itemId) {
                    await this.enrichmentItemStateService.syncItemState(payload.itemId);
                }
            }

            if (task.webhook_log_id) {
                await this.db.query(
                    `UPDATE webhook_log SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
                    [task.webhook_log_id, error.message]
                );
            }
        }
    }

    async isOmdbSslBlocked(omdbApiKey, title) {
        const now = Date.now();

        if (this.omdbSslBlockedUntil === 0 || now >= this.omdbSslBlockedUntil) {
            return false;
        }

        if ((now - this.lastOmdbSslProbeAt) < this.omdbSslRecoveryProbeMs) {
            return true;
        }

        this.lastOmdbSslProbeAt = now;

        try {
            const health = await this.omdbService.checkHealth(omdbApiKey);
            if (health?.healthy) {
                this.omdbSslBlockedUntil = 0;
                this.lastOmdbSslWarnAt = 0;
                this.logger.info('OMDb SSL recovery detected; resuming OMDb enrichment', { title });
                return false;
            }

            if (health?.ssl_error) {
                this.omdbSslBlockedUntil = now + this.omdbSslBlockMs;
                if ((now - this.lastOmdbSslWarnAt) >= this.omdbSslWarnThrottleMs) {
                    this.lastOmdbSslWarnAt = now;
                    this.logger.warn('OMDb SSL certificate issue persists; OMDb enrichment remains temporarily paused', {
                        title,
                        message: health.message
                    });
                } else {
                    this.logger.debug('OMDb SSL persistent warning suppressed', { title });
                }
                return true;
            }
        } catch (healthError) {
            this.logger.debug('OMDb SSL recovery probe failed', {
                title,
                error: healthError.message
            });
        }

        return true;
    }

    resetOmdbState() {
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
    }
}
