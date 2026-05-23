import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    PHASES,
    PHASE_METADATA,
    parsePayload as _parsePayload,
    parsePhaseHistory,
    extractDisplayInfo as _extractDisplayInfo,
    buildPhaseList as _buildPhaseList,
    resolveSkippedPhases as _resolveSkippedPhases,
    isValidPhase as _isValidPhase,
    getPhaseMetadata as _getPhaseMetadata,
    getPhaseCount as _getPhaseCount,
} from './classificationPhaseUtils.mjs';

const logger = createLogger('ClassificationPhaseService');

export class ClassificationPhaseService {
    constructor() {
        this.webSocketService = null;
    }

    setWebSocketService(wsService) {
        this.webSocketService = wsService;
    }

    async updatePhase(taskId, phase, metadata = {}) {
        if (!this.isValidPhase(phase)) {
            logger.warn('Invalid phase', { taskId, phase });
            return null;
        }

        const phaseIndex = PHASES.indexOf(phase) + 1;
        const now = new Date().toISOString();

        try {
            const task = await db.query(
                'SELECT current_phase, phase_started_at, phase_history, payload FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) {
                logger.warn('Task not found for phase update', { taskId, phase });
                return null;
            }

            const currentTask = task.rows[0];
            const history = parsePhaseHistory(currentTask.phase_history);

            const skippedPhases = this.resolveSkippedPhases({
                currentPhase: currentTask.current_phase,
                targetPhase: phase,
                requested: metadata.skippedPhases,
                history
            });

            if (currentTask.current_phase && currentTask.phase_started_at) {
                const prevDuration = Date.now() - new Date(currentTask.phase_started_at).getTime();
                history.push({
                    phase: currentTask.current_phase,
                    started_at: currentTask.phase_started_at,
                    completed_at: now,
                    duration_ms: prevDuration,
                    metadata: metadata.prevPhaseMetadata || {}
                });
            }

            for (const skippedPhase of skippedPhases) {
                history.push({
                    phase: skippedPhase,
                    status: 'skipped',
                    started_at: now,
                    completed_at: now,
                    duration_ms: 0,
                    metadata: metadata.skippedPhaseMetadata?.[skippedPhase] || metadata.skipMetadata || {}
                });
            }

            await db.query(
                `UPDATE task_queue 
         SET current_phase = $1, 
             phase_index = $2, 
             phase_started_at = $3,
             phase_history = $4
         WHERE id = $5`,
                [phase, phaseIndex, now, JSON.stringify(history), taskId]
            );

            logger.debug('Phase updated', { taskId, phase, phaseIndex });

            const payload = this.parsePayload(currentTask.payload);
            const displayInfo = this.extractDisplayInfo(payload);

            this.emitProgressEvent(taskId, phase, phaseIndex, {
                ...metadata,
                title: displayInfo.title,
                source_library_id: payload?.source_library_id,
                method: payload?.method
            });

            return { taskId, phase, phaseIndex, history };
        } catch (error) {
            logger.error('Failed to update phase', { taskId, phase, error: error.message });
            throw error;
        }
    }

    async getProgress(taskId) {
        try {
            const result = await db.query(
                `SELECT id, payload, current_phase, phase_index, phase_started_at, phase_history, status
         FROM task_queue WHERE id = $1`,
                [taskId]
            );

            if (result.rows.length === 0) return null;

            const task = result.rows[0];
            const payload = this.parsePayload(task.payload);
            const displayInfo = this.extractDisplayInfo(payload);

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
                phases: this.buildPhaseList(task),
                status: task.status
            };
        } catch (error) {
            logger.error('Failed to get progress', { taskId, error: error.message });
            return null;
        }
    }

    async getActiveClassifications() {
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

            return result.rows.map(task => {
                const payload = this.parsePayload(task.payload);
                const displayInfo = this.extractDisplayInfo(payload);
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
                    createdAt: task.created_at,
                    phases: this.buildPhaseList(task),
                    phaseMetadata: PHASE_METADATA[task.current_phase] || null
                };
            });
        } catch (error) {
            logger.error('Failed to get active classifications', { error: error.message });
            return [];
        }
    }

    async resumeFromPhase(taskId) {
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

    async completeTracking(taskId, finalResult = {}) {
        try {
            const now = new Date().toISOString();

            const task = await db.query(
                'SELECT current_phase, phase_started_at, phase_history FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) return;

            const currentTask = task.rows[0];
            const history = parsePhaseHistory(currentTask.phase_history);

            if (currentTask.current_phase && currentTask.phase_started_at) {
                const prevDuration = Date.now() - new Date(currentTask.phase_started_at).getTime();
                history.push({
                    phase: currentTask.current_phase,
                    started_at: currentTask.phase_started_at,
                    completed_at: now,
                    duration_ms: prevDuration,
                    metadata: finalResult
                });
            }

            await db.query(
                `UPDATE task_queue 
         SET current_phase = NULL, 
             phase_index = NULL, 
             phase_started_at = NULL,
             phase_history = $1
         WHERE id = $2`,
                [JSON.stringify(history), taskId]
            );

            if (this.webSocketService) {
                this.webSocketService.emitTaskProgress(taskId, {
                    taskId,
                    phase: 'completed',
                    phaseIndex: PHASES.length,
                    totalPhases: PHASES.length,
                    progress: 100,
                    completed: true,
                    result: finalResult
                });
            }

            logger.info('Phase tracking completed', { taskId, totalPhases: history.length });
        } catch (error) {
            logger.error('Failed to complete tracking', { taskId, error: error.message });
        }
    }

    buildPhaseList(task) {
        return _buildPhaseList(task);
    }

    resolveSkippedPhases(input) {
        return _resolveSkippedPhases(input);
    }

    parsePayload(rawPayload) {
        return _parsePayload(rawPayload);
    }

    extractDisplayInfo(payload) {
        return _extractDisplayInfo(payload);
    }

    emitProgressEvent(taskId, phase, phaseIndex, metadata = {}) {
        if (!this.webSocketService) {
            logger.debug('WebSocket service not available, skipping emit');
            return;
        }

        if (metadata.source_library_id || metadata.method === 'source_library') {
            return;
        }

        const phaseInfo = PHASE_METADATA[phase] || { icon: '⏳', label: phase };

        this.webSocketService.emitTaskProgress(taskId, {
            taskId,
            phase,
            phaseIndex,
            totalPhases: PHASES.length,
            progress: Math.round((phaseIndex / PHASES.length) * 100),
            startedAt: new Date().toISOString(),
            icon: phaseInfo.icon,
            label: phaseInfo.label,
            description: phaseInfo.description,
            title: metadata.title,
            ...metadata
        });
    }

    getPhaseMetadata() {
        return _getPhaseMetadata();
    }

    isValidPhase(phase) {
        return _isValidPhase(phase);
    }

    getPhaseCount() {
        return _getPhaseCount();
    }
}

export const classificationPhaseService = new ClassificationPhaseService();
