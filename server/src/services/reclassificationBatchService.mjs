import { createLogger } from '../utils/logger.mjs';
import { reclassificationService } from './reclassificationService.mjs';
import { ensureTables as ensureSchema } from './reclassificationBatchSchema.mjs';
import { validateBatch as processValidateBatch, executeBatch as processExecuteBatch } from './reclassificationBatchProcessing.mjs';
import {
    getBatchStatus as queryGetBatchStatus,
    getBatchProgress as queryGetBatchProgress,
    listBatches as queryListBatches,
    createBatch as queryCreateBatch,
    pauseBatch as queryPauseBatch,
    cancelBatch as queryCancelBatch,
    skipItem as querySkipItem,
    retryItem as queryRetryItem
} from './reclassificationBatchQueries.mjs';

const logger = createLogger('ReclassificationBatchService');

class ReclassificationBatchService {
    constructor(deps = {}) {
        this.initialized = false;
        this.reclassificationService = deps.reclassificationService || reclassificationService;
    }

    async getReclassificationService() {
        return this.reclassificationService;
    }

    async ensureTables() {
        if (this.initialized) return;

        try {
            await ensureSchema();
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize batch tables', { error: error.message });
            throw error;
        }
    }

    async createBatch(items, options = {}) {
        await this.ensureTables();
        return queryCreateBatch(items, options);
    }

    async validateBatch(batchId) {
        await this.ensureTables();
        await processValidateBatch(batchId, {
            getReclassificationService: () => this.getReclassificationService()
        });
        return this.getBatchStatus(batchId);
    }

    async executeBatch(batchId) {
        await this.ensureTables();
        return processExecuteBatch(batchId, {
            getReclassificationService: () => this.getReclassificationService(),
            getBatchStatus: (id) => this.getBatchStatus(id)
        });
    }

    async pauseBatch(batchId) {
        return queryPauseBatch(batchId, {
            getBatchStatus: (id) => this.getBatchStatus(id)
        });
    }

    async resumeBatch(batchId) {
        return this.executeBatch(batchId);
    }

    async cancelBatch(batchId) {
        return queryCancelBatch(batchId, {
            getBatchStatus: (id) => this.getBatchStatus(id)
        });
    }

    async skipItem(batchId, itemId) {
        return querySkipItem(batchId, itemId, {
            getBatchStatus: (id) => this.getBatchStatus(id)
        });
    }

    async retryItem(batchId, itemId) {
        return queryRetryItem(batchId, itemId, {
            getBatchStatus: (id) => this.getBatchStatus(id)
        });
    }

    async getBatchStatus(batchId) {
        await this.ensureTables();
        return queryGetBatchStatus(batchId);
    }

    async getBatchProgress(batchId) {
        await this.ensureTables();
        return queryGetBatchProgress(batchId);
    }

    async listBatches(limit = 20) {
        await this.ensureTables();
        return queryListBatches(limit);
    }
}

export const reclassificationBatchService = new ReclassificationBatchService();
