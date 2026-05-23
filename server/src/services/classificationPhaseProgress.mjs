import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { PHASES, PHASE_METADATA, parsePayload, extractDisplayInfo, buildPhaseList } from './classificationPhaseUtils.mjs';

const logger = createLogger('ClassificationPhaseService');

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
        totalPhases: PHASES.length,
        progress: task.phase_index ? Math.round((task.phase_index / PHASES.length) * 100) : 0,
        phaseStartedAt: task.phase_started_at,
        phaseDuration: task.phase_started_at
            ? Date.now() - new Date(task.phase_started_at).getTime()
            : 0,
        phases: buildPhaseList(task),
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
            phaseMetadata: PHASE_METADATA[task.current_phase] || null,
        }));
    } catch (error) {
        logger.error('Failed to get active classifications', { error: error.message });
        return [];
    }
}

export async function resumeFromPhase(taskId) {
    try {
        const task = await db.query(
            'SELECT current_phase, phase_index FROM task_queue WHERE id = $1',
            [taskId]
        );

        if (task.rows.length === 0) return null;

        const phase = task.rows[0].current_phase;
        if (phase) {
            logger.info('Resuming task from phase', { taskId, phase });
        }
        return phase;
    } catch (error) {
        logger.error('Failed to get resume phase', { taskId, error: error.message });
        return null;
    }
}
