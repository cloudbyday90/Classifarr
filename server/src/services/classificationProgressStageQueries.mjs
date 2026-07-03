import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    STAGES,
    STAGE_METADATA,
    parsePayload,
    extractDisplayInfo,
    buildStageList
} from './classificationProgressStageUtils.mjs';

const logger = createLogger('classificationProgressStageService');

function buildProgressEntry(task) {
    const payload = parsePayload(task.payload);
    const displayInfo = extractDisplayInfo(payload);

    return {
        taskId: task.id,
        title: displayInfo.title,
        year: displayInfo.year,
        mediaType: displayInfo.mediaType,
        currentPhase: task.current_phase,
        phaseIndex: task.phase_index || 0,
        totalPhases: STAGES.length,
        progress: task.phase_index ? Math.round((task.phase_index / STAGES.length) * 100) : 0,
        phaseStartedAt: task.phase_started_at,
        phaseDuration: task.phase_started_at
            ? Date.now() - new Date(task.phase_started_at).getTime()
            : 0,
        phases: buildStageList(task),
    };
}

export async function getProgress(taskId) {
    try {
        const result = await db.query(
            `SELECT id, payload, current_phase, phase_index, phase_started_at, phase_history, status
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
            `SELECT id, payload, current_phase, phase_index, phase_started_at, phase_history, created_at
         FROM task_queue 
         WHERE status = 'processing' 
           AND current_phase IS NOT NULL
           AND (payload::jsonb->>'source_library_id') IS NULL
           AND (payload::jsonb->>'method') IS DISTINCT FROM 'source_library'
         ORDER BY created_at DESC
         LIMIT 50`
        );

        return result.rows.map(task => ({
            ...buildProgressEntry(task),
            createdAt: task.created_at,
            phaseMetadata: STAGE_METADATA[task.current_phase] || null,
        }));
    } catch (error) {
        logger.error('Failed to get active classifications', { error: error.message });
        return [];
    }
}

export async function resumeFromStage(taskId) {
    try {
        const task = await db.query(
            'SELECT current_phase, phase_index FROM task_queue WHERE id = $1',
            [taskId]
        );

        if (task.rows.length === 0) return null;

        const stage = task.rows[0].current_phase;
        if (stage) {
            logger.info('Resuming task from stage', { taskId, stage });
        }
        return stage;
    } catch (error) {
        logger.error('Failed to get resume phase', { taskId, error: error.message });
        return null;
    }
}

export async function resumeFromPhase(taskId) {
    return resumeFromStage(taskId);
}
