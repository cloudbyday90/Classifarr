import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { reclassificationService } from './reclassificationService.mjs';
import { ensureTables as ensureSchema } from './reclassificationBatchSchema.mjs';
import { createBatchCoordinatorRepository } from './reclassificationBatchCoordinatorRepository.mjs';
import { getBatchActivity } from './reclassificationBatchActivity.mjs';
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

function normalizeBatchItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('Items array is required and must not be empty');
    }
    return Array.from(items, item => {
        const classificationId = canonicalDatabaseBigintId(item?.classificationId);
        if (classificationId === null) throw new ValidationError('Each batch item requires a valid classification ID.');
        return { classificationId, targetLibraryId: item.targetLibraryId };
    });
}

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
        const normalizedItems = normalizeBatchItems(items);
        await this.ensureTables();
        return queryCreateBatch(normalizedItems, options);
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

    async getBatchActivity(after) {
        await this.ensureTables();
        return getBatchActivity(after);
    }
}

export const reclassificationBatchService = new ReclassificationBatchService();
