import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    STAGES,
    STAGE_METADATA,
    parsePayload as _parsePayload,
    parseStageHistory,
    extractDisplayInfo as _extractDisplayInfo,
    buildStageList as _buildStageList,
    resolveSkippedStages as _resolveSkippedStages,
    isValidStage as _isValidStage,
    getStageMetadata as _getStageMetadata,
    getStageCount as _getStageCount,
} from './classificationProgressStageUtils.mjs';
import { getProgress as _getProgress, getActiveClassifications as _getActiveClassifications, resumeFromStage as _resumeFromStage } from './classificationProgressStageQueries.mjs';
import { buildStageProgressEvent } from './classificationProgressStageContract.mjs';

const logger = createLogger('classificationProgressStageService');

export class ClassificationProgressStageService {
    constructor() {
        this.webSocketService = null;
    }

    setWebSocketService(wsService) {
        this.webSocketService = wsService;
    }

    async updateStage(taskId, stage, metadata = {}) {
        if (!this.isValidStage(stage)) {
            logger.warn('Invalid stage', { taskId, stage });
            return null;
        }

        const stageIndex = STAGES.indexOf(stage) + 1;
        const now = new Date().toISOString();

        try {
            const task = await db.query(
                'SELECT current_stage, stage_started_at, stage_history, payload FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) {
                logger.warn('Task not found for stage update', { taskId, stage });
                return null;
            }

            const currentTask = task.rows[0];
            const history = parseStageHistory(currentTask.stage_history);

            const skippedStages = this.resolveSkippedStages({
                currentStage: currentTask.current_stage,
                targetStage: stage,
                requested: metadata.skippedStages,
                history
            });

            if (currentTask.current_stage && currentTask.stage_started_at) {
                const prevDuration = Date.now() - new Date(currentTask.stage_started_at).getTime();
                history.push({
                    stage: currentTask.current_stage,
                    started_at: currentTask.stage_started_at,
                    completed_at: now,
                    duration_ms: prevDuration,
                    metadata: metadata.previousStageMetadata || {}
                });
            }

            for (const skippedStage of skippedStages) {
                history.push({
                    stage: skippedStage,
                    status: 'skipped',
                    started_at: now,
                    completed_at: now,
                    duration_ms: 0,
                    metadata: metadata.skippedStageMetadata?.[skippedStage] || metadata.skipMetadata || {}
                });
            }

            await db.query(
                `UPDATE task_queue
         SET current_stage = $1,
             stage_index = $2,
             stage_started_at = $3,
             stage_history = $4
         WHERE id = $5`,
                [stage, stageIndex, now, JSON.stringify(history), taskId]
            );

            logger.debug('Classification progress stage updated', { taskId, stage, stageIndex });

            const payload = this.parsePayload(currentTask.payload);
            const displayInfo = this.extractDisplayInfo(payload);

            this.emitProgressEvent(taskId, stage, stageIndex, {
                ...metadata,
                title: displayInfo.title,
                source_library_id: payload?.source_library_id,
                method: payload?.method
            });

            return {
                taskId,
                stage,
                stageIndex,
                totalStages: STAGES.length,
                history
            };
        } catch (error) {
            logger.error('Failed to update classification progress stage', { taskId, stage, error: error.message });
            throw error;
        }
    }

    async getProgress(taskId) {
        return _getProgress(taskId);
    }

    async getActiveClassifications() {
        return _getActiveClassifications();
    }

    async resumeFromStage(taskId) {
        return _resumeFromStage(taskId);
    }

    async completeTracking(taskId, finalResult = {}) {
        try {
            const now = new Date().toISOString();

            const task = await db.query(
                'SELECT current_stage, stage_started_at, stage_history FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) return;

            const currentTask = task.rows[0];
            const history = parseStageHistory(currentTask.stage_history);

            if (currentTask.current_stage && currentTask.stage_started_at) {
                const prevDuration = Date.now() - new Date(currentTask.stage_started_at).getTime();
                history.push({
                    stage: currentTask.current_stage,
                    started_at: currentTask.stage_started_at,
                    completed_at: now,
                    duration_ms: prevDuration,
                    metadata: finalResult
                });
            }

            await db.query(
                `UPDATE task_queue
         SET current_stage = NULL,
             stage_index = NULL,
             stage_started_at = NULL,
             stage_history = $1
         WHERE id = $2`,
                [JSON.stringify(history), taskId]
            );

            if (this.webSocketService) {
                this.webSocketService.emitTaskProgress(taskId, buildStageProgressEvent({
                    taskId,
                    stage: 'completed',
                    stageIndex: STAGES.length,
                    totalStages: STAGES.length,
                    progress: 100,
                    completed: true,
                    result: finalResult
                }));
            }

            logger.info('Classification progress stage tracking completed', { taskId, totalStages: history.length });
        } catch (error) {
            logger.error('Failed to complete tracking', { taskId, error: error.message });
        }
    }

    emitProgressEvent(taskId, stage, stageIndex, metadata = {}) {
        if (!this.webSocketService) {
            logger.debug('WebSocket service not available, skipping emit');
            return;
        }

        if (metadata.source_library_id || metadata.method === 'source_library') {
            return;
        }

        const stageInfo = STAGE_METADATA[stage] || { icon: '⏳', label: stage };

        this.webSocketService.emitTaskProgress(taskId, buildStageProgressEvent({
            taskId,
            stage,
            stageIndex,
            totalStages: STAGES.length,
            progress: Math.round((stageIndex / STAGES.length) * 100),
            startedAt: new Date().toISOString(),
            icon: stageInfo.icon,
            label: stageInfo.label,
            description: stageInfo.description,
            title: metadata.title,
            ...metadata
        }));
    }

    buildStageList(task) {
        return _buildStageList(task);
    }

    resolveSkippedStages(input) {
        return _resolveSkippedStages(input);
    }

    parsePayload(rawPayload) {
        return _parsePayload(rawPayload);
    }

    extractDisplayInfo(payload) {
        return _extractDisplayInfo(payload);
    }

    getStageMetadata() {
        return _getStageMetadata();
    }

    isValidStage(stage) {
        return _isValidStage(stage);
    }

    getStageCount() {
        return _getStageCount();
    }

}

export const classificationProgressStageService = new ClassificationProgressStageService();
