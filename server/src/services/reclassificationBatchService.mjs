import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import { reclassificationService } from './reclassificationService.mjs';
import { ensureTables as ensureSchema } from './reclassificationBatchSchema.mjs';
import { createBatchCoordinatorRepository } from './reclassificationBatchCoordinatorRepository.mjs';
import { validateBatch as processValidateBatch } from './reclassificationBatchProcessing.mjs';
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

export class ReclassificationBatchService {
    constructor(deps = {}) {
        this.initialized = false;
        this.coordinatorRepository = deps.coordinatorRepository || createBatchCoordinatorRepository(db);
        this.reclassificationService = deps.reclassificationService || reclassificationService;
    }

    async getReclassificationService() {
        return this.reclassificationService;
    }

    async ensureTables() {
        if (this.initialized) return;

        return withServiceCatch(logger, 'Failed to initialize batch tables', async () => {
            await ensureSchema();
            this.initialized = true;
        });
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
        await this.coordinatorRepository.start(batchId);
        return this.getBatchStatus(batchId);
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
