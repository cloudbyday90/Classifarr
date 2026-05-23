import { enrichmentRetryService } from './enrichmentRetryService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { checkRagBackfillSchedule as _checkRagBackfillSchedule, runRagBackfill as _runRagBackfill } from './schedulerServiceRagBackfill.mjs';
import { executeTask as _executeTask, runLibraryScan as _runLibraryScan, runFullRescan as _runFullRescan, runLogCleanup as _runLogCleanup } from './schedulerServiceTasks.mjs';
import {
    getAllTasks as _getAllTasks,
    getTaskById as _getTaskById,
    createTask as _createTask,
    updateTask as _updateTask,
    deleteTask as _deleteTask,
    ensureDefaultTasks as _ensureDefaultTasks,
    updateTaskAfterRun as _updateTaskAfterRun,
    getDueTasks as _getDueTasks
} from './schedulerServiceCrud.mjs';

const logger = createLogger('SchedulerService');

class SchedulerService {
    constructor() {
        this.isRunning = false;
        this.pollInterval = null;
        this.checkIntervalMs = 60000;
    }

    resetState() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isRunning = false;
        this.checkIntervalMs = 60000;
    }

    async start() {
        if (this.isRunning) {
            logger.info('Scheduler already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting scheduler service');

        await this.checkDueTasks();

        try {
            const backfillResult = await enrichmentRetryService.backfillRetryQueue();
            if (backfillResult.queued > 0) {
                logger.info('Enrichment retry queue backfill complete', { queued: backfillResult.queued });
            }
        } catch (err) {
            logger.debug('Enrichment retry queue backfill skipped', { error: err.message });
        }

        try {
            await this.ensureDefaultTasks();
        } catch (err) {
            logger.debug('Could not seed default tasks', { error: err.message });
        }

        this.pollInterval = setInterval(() => this.checkDueTasks(), this.checkIntervalMs);
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isRunning = false;
        logger.info('Scheduler service stopped');
    }

    async checkDueTasks() {
        try {
            const dueTasks = await this.getDueTasks();

            for (const task of dueTasks) {
                await this.executeTask(task);
            }

            await this.checkRagBackfillSchedule();
        } catch (error) {
            logger.error('Error checking due tasks', { error: error.message });
        }
    }

    async getDueTasks() {
        return _getDueTasks();
    }

    async checkRagBackfillSchedule() {
        return _checkRagBackfillSchedule({ runRagBackfill: () => this.runRagBackfill() });
    }

    async runRagBackfill() {
        return _runRagBackfill();
    }

    async executeTask(task) {
        return _executeTask(task, {
            runLibraryScan: (id) => this.runLibraryScan(id),
            runFullRescan: (id) => this.runFullRescan(id),
            runLogCleanup: () => this.runLogCleanup(),
            updateTaskAfterRun: (id, status, result) => this.updateTaskAfterRun(id, status, result)
        });
    }

    async runLibraryScan(libraryId) {
        return _runLibraryScan(libraryId);
    }

    async runFullRescan(libraryId) {
        return _runFullRescan(libraryId);
    }

    async runLogCleanup() {
        return _runLogCleanup();
    }

    async ensureDefaultTasks() {
        return _ensureDefaultTasks();
    }

    async updateTaskAfterRun(taskId, status, result) {
        return _updateTaskAfterRun(taskId, status, result);
    }

    async getAllTasks() {
        return _getAllTasks();
    }

    async getTaskById(id) {
        return _getTaskById(id);
    }

    async createTask(data) {
        return _createTask(data);
    }

    async updateTask(id, data) {
        return _updateTask(id, data);
    }

    async deleteTask(id) {
        return _deleteTask(id);
    }

    async runNow(id) {
        const task = await this.getTaskById(id);
        if (!task) {
            throw new Error('Task not found');
        }
        await this.executeTask(task);
        return { message: 'Task executed' };
    }
}

export const schedulerService = new SchedulerService();
