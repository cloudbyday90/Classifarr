/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ClassificationPhaseService');

// Classification phases in order
const PHASES = [
    'queued',
    'metadata_fetch',
    'policy_eval',
    'rag_analysis',
    'signal_combine',
    'ai_analysis',
    'decision',
    'notification'
];

// Phase metadata for UI display
const PHASE_METADATA = {
    queued: { icon: '⏳', label: 'Queued', description: 'Item received, waiting to be processed' },
    metadata_fetch: { icon: '📥', label: 'Metadata Fetch', description: 'Fetching TMDB/TVDB metadata' },
    policy_eval: { icon: '📋', label: 'Policy Evaluation', description: 'Running PolicyEngine matching' },
    rag_analysis: { icon: '🧠', label: 'RAG Analysis', description: 'Running embeddings similarity search' },
    signal_combine: { icon: '⚖️', label: 'Signal Combination', description: 'Combining scores from all engines' },
    ai_analysis: { icon: '🤖', label: 'AI Analysis', description: 'Running AI classification analysis' },
    decision: { icon: '✅', label: 'Decision', description: 'Final classification decision made' },
    notification: { icon: '📤', label: 'Notification', description: 'Sending to *arr / notifications' }
};

class ClassificationPhaseService {
    constructor() {
        this.webSocketService = null;
    }

    /**
     * Set WebSocket service reference (called during initialization)
     * @param {Object} wsService - WebSocket service instance
     */
    setWebSocketService(wsService) {
        this.webSocketService = wsService;
    }

    /**
     * Update the current phase for a task
     * @param {number} taskId - Task ID
     * @param {string} phase - Current phase name
     * @param {Object} metadata - Optional metadata about the phase
     * @returns {Promise<Object>} Updated task data
     */
    async updatePhase(taskId, phase, metadata = {}) {
        if (!this.isValidPhase(phase)) {
            logger.warn('Invalid phase', { taskId, phase });
            return null;
        }

        const phaseIndex = PHASES.indexOf(phase) + 1;
        const now = new Date().toISOString();

        try {
            // Get current task to update history
            const task = await db.query(
                'SELECT current_phase, phase_started_at, phase_history, payload FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) {
                logger.warn('Task not found for phase update', { taskId, phase });
                return null;
            }

            const currentTask = task.rows[0];
            let history = currentTask.phase_history || [];

            // Ensure history is an array
            if (typeof history === 'string') {
                try {
                    history = JSON.parse(history);
                } catch {
                    history = [];
                }
            }

            const skippedPhases = this.resolveSkippedPhases({
                currentPhase: currentTask.current_phase,
                targetPhase: phase,
                requested: metadata.skippedPhases,
                history
            });

            // Complete previous phase if exists
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

            // Persist explicit skipped phases between current and target phases
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

            // Update to new phase
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

            // Get title for WebSocket event
            const payload = typeof currentTask.payload === 'string'
                ? JSON.parse(currentTask.payload)
                : currentTask.payload;

            // Emit WebSocket event for real-time updates
            this.emitProgressEvent(taskId, phase, phaseIndex, {
                ...metadata,
                title: payload?.title || 'Unknown',
                // Important: Pass filtering fields from payload to ensure emitProgressEvent can filter source_library
                source_library_id: payload?.source_library_id,
                method: payload?.method
            });

            return { taskId, phase, phaseIndex, history };
        } catch (error) {
            logger.error('Failed to update phase', { taskId, phase, error: error.message });
            throw error;
        }
    }

    /**
     * Get current progress for a task
     * @param {number} taskId - Task ID
     * @returns {Promise<Object|null>} Progress data
     */
    async getProgress(taskId) {
        try {
            const result = await db.query(
                `SELECT id, payload, current_phase, phase_index, phase_started_at, phase_history, status
         FROM task_queue WHERE id = $1`,
                [taskId]
            );

            if (result.rows.length === 0) return null;

            const task = result.rows[0];
            const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

            return {
                taskId: task.id,
                title: payload?.title || 'Unknown',
                year: payload?.year,
                mediaType: payload?.media_type,
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

    /**
     * Get all active classifications with progress
     * @returns {Promise<Array>} Array of active classifications
     */
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
                const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                return {
                    taskId: task.id,
                    title: payload?.title || 'Unknown',
                    year: payload?.year,
                    mediaType: payload?.media_type,
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

    /**
     * Resume task from stored phase after restart
     * @param {number} taskId - Task ID
     * @returns {Promise<string|null>} Phase to resume from
     */
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

    /**
     * Complete phase tracking for a task
     * @param {number} taskId - Task ID
     * @param {Object} finalResult - Final classification result
     */
    async completeTracking(taskId, finalResult = {}) {
        try {
            const now = new Date().toISOString();

            const task = await db.query(
                'SELECT current_phase, phase_started_at, phase_history FROM task_queue WHERE id = $1',
                [taskId]
            );

            if (task.rows.length === 0) return;

            const currentTask = task.rows[0];
            let history = currentTask.phase_history || [];

            // Ensure history is an array
            if (typeof history === 'string') {
                try {
                    history = JSON.parse(history);
                } catch {
                    history = [];
                }
            }

            // Complete the last phase
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

            // Clear phase tracking on completion
            await db.query(
                `UPDATE task_queue 
         SET current_phase = NULL, 
             phase_index = NULL, 
             phase_started_at = NULL,
             phase_history = $1
         WHERE id = $2`,
                [JSON.stringify(history), taskId]
            );

            // Emit completion event
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

    /**
     * Build phase list for a task with status
     * @param {Object} task - Task object
     * @returns {Array} Phase list with status
     */
    buildPhaseList(task) {
        let history = task.phase_history || [];

        // Ensure history is an array
        if (typeof history === 'string') {
            try {
                history = JSON.parse(history);
            } catch {
                history = [];
            }
        }

        const currentPhaseIndex = PHASES.indexOf(task.current_phase);

        return PHASES.map((phase, index) => {
            const historyEntry = history.find(h => h.phase === phase);

            if (historyEntry) {
                const status = historyEntry.status === 'skipped' ? 'skipped' : 'complete';
                return {
                    name: phase,
                    ...historyEntry,
                    status,
                    ...PHASE_METADATA[phase]
                };
            } else if (index === currentPhaseIndex) {
                return {
                    name: phase,
                    status: 'in_progress',
                    started_at: task.phase_started_at,
                    ...PHASE_METADATA[phase]
                };
            } else {
                return {
                    name: phase,
                    status: 'pending',
                    ...PHASE_METADATA[phase]
                };
            }
        });
    }

    /**
     * Resolve skipped phases for a transition while preserving phase order.
     * @param {Object} input
     * @returns {Array<string>} Ordered valid skipped phases
     */
    resolveSkippedPhases(input = {}) {
        const requested = Array.isArray(input.requested) ? input.requested : [];
        if (requested.length === 0) {
            return [];
        }

        const history = Array.isArray(input.history) ? input.history : [];
        const currentPhase = input.currentPhase || null;
        const targetPhase = input.targetPhase || null;
        const currentPhaseIndex = PHASES.indexOf(currentPhase);
        const targetPhaseIndex = PHASES.indexOf(targetPhase);
        const historicalPhases = new Set(history.map((entry) => entry.phase));
        const boundedForwardTransition = currentPhaseIndex >= 0
            && targetPhaseIndex >= 0
            && targetPhaseIndex > currentPhaseIndex;

        return [...new Set(requested)]
            .filter((phase) => this.isValidPhase(phase))
            .filter((phase) => phase !== currentPhase && phase !== targetPhase)
            .filter((phase) => !historicalPhases.has(phase))
            .filter((phase) => {
                if (!boundedForwardTransition) {
                    return true;
                }
                const phaseIndex = PHASES.indexOf(phase);
                return phaseIndex > currentPhaseIndex && phaseIndex < targetPhaseIndex;
            })
            .sort((a, b) => PHASES.indexOf(a) - PHASES.indexOf(b));
    }

    /**
     * Emit WebSocket progress event
     * @param {number} taskId - Task ID
     * @param {string} phase - Current phase
     * @param {number} phaseIndex - Phase index (1-based)
     * @param {Object} metadata - Additional metadata
     */
    emitProgressEvent(taskId, phase, phaseIndex, metadata = {}) {
        if (!this.webSocketService) {
            logger.debug('WebSocket service not available, skipping emit');
            return;
        }

        // Filter out source_library tasks to prevent dashboard clutter
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

    /**
     * Get phase metadata for all phases
     * @returns {Array} Phase metadata array
     */
    getPhaseMetadata() {
        return PHASES.map(phase => ({
            name: phase,
            index: PHASES.indexOf(phase) + 1,
            ...PHASE_METADATA[phase]
        }));
    }

    /**
     * Check if phase is valid
     * @param {string} phase - Phase name
     * @returns {boolean} True if valid phase
     */
    isValidPhase(phase) {
        return PHASES.includes(phase);
    }

    /**
     * Get phase count
     * @returns {number} Total number of phases
     */
    getPhaseCount() {
        return PHASES.length;
    }
}

// Export singleton instance
module.exports = new ClassificationPhaseService();
