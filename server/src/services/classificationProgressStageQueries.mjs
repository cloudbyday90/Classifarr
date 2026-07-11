import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    STAGES,
    STAGE_METADATA,
    parsePayload,
    extractDisplayInfo,
    buildStageList
} from './classificationProgressStageUtils.mjs';
import { buildStageProgressFields } from './classificationProgressStageContract.mjs';

const logger = createLogger('classificationProgressStageService');

function buildProgressEntry(task, options = {}) {
    const payload = parsePayload(task.payload);
    const displayInfo = extractDisplayInfo(payload);
    const stageIndex = task.stage_index || 0;
    const stageStartedAt = task.stage_started_at;
    const stageDuration = stageStartedAt
        ? Date.now() - new Date(stageStartedAt).getTime()
        : 0;
    const stages = buildStageList(task);

    return {
        taskId: task.id,
        title: displayInfo.title,
        year: displayInfo.year,
        mediaType: displayInfo.mediaType,
        ...buildStageProgressFields({
            currentStage: task.current_stage,
            stageIndex,
            totalStages: STAGES.length,
            stageStartedAt,
            stageDuration,
            stages,
            stageMetadata: options.stageMetadata || null,
        }),
        progress: stageIndex ? Math.round((stageIndex / STAGES.length) * 100) : 0,
    };
}

export async function getProgress(taskId) {
    try {
        const result = await db.query(
            `SELECT id, payload, current_stage, stage_index, stage_started_at, stage_history, status
         FROM task_queue WHERE id = $1`,
            [taskId]
        );

        if (result.rows.length === 0) return null;

        const task = result.rows[0];
        return {
            ...buildProgressEntry(task),
            status: task.status,
        };
    } catch (error) {
        logger.error('Failed to get progress', { taskId, error: error.message });
        return null;
    }
}

export async function getActiveClassifications() {
    try {
        const result = await db.query(
            `SELECT id, payload, current_stage, stage_index, stage_started_at, stage_history, created_at
         FROM task_queue 
         WHERE status = 'processing' 
           AND current_stage IS NOT NULL
           AND (payload::jsonb->>'source_library_id') IS NULL
           AND (payload::jsonb->>'method') IS DISTINCT FROM 'source_library'
         ORDER BY created_at DESC
         LIMIT 50`
        );

        return result.rows.map(task => ({
            ...buildProgressEntry(task, {
                stageMetadata: STAGE_METADATA[task.current_stage] || null,
            }),
            createdAt: task.created_at,
        }));
    } catch (error) {
        logger.error('Failed to get active classifications', { error: error.message });
        return [];
    }
}

export async function resumeFromStage(taskId) {
    try {
        const task = await db.query(
            'SELECT current_stage, stage_index FROM task_queue WHERE id = $1',
            [taskId]
        );

        if (task.rows.length === 0) return null;

        const stage = task.rows[0].current_stage;
        if (stage) {
            logger.info('Resuming task from stage', { taskId, stage });
        }
        return stage;
    } catch (error) {
        logger.error('Failed to get resume phase', { taskId, error: error.message });
        return null;
    }
}
